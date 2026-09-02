import { prisma } from '../database/prisma';
import type { GuildSettings } from '@prisma/client';

export async function getProfile(guildId: string, userId: string) {
  await prisma.user.upsert({ where: { id: userId }, update: {}, create: { id: userId, username: 'unknown' } });
  return prisma.economyProfile.upsert({
    where: { guildId_userId: { guildId, userId } },
    update: {},
    create: { guildId, userId }
  });
}

export async function addWallet(guildId: string, userId: string, amount: number) {
  await getProfile(guildId, userId);
  return prisma.economyProfile.update({ where: { guildId_userId: { guildId, userId } }, data: { wallet: { increment: amount } } });
}

export interface DailyResult {
  amount: number;
  streak: number;
  onCooldownMs?: number;
}

export async function claimDaily(guildId: string, userId: string, settings: GuildSettings): Promise<DailyResult> {
  const profile = await getProfile(guildId, userId);
  const now = Date.now();
  if (profile.lastDailyAt) {
    const elapsed = now - profile.lastDailyAt.getTime();
    if (elapsed < 86_400_000) return { amount: 0, streak: profile.dailyStreak, onCooldownMs: 86_400_000 - elapsed };
  }
  const keptStreak = profile.lastDailyAt && now - profile.lastDailyAt.getTime() < 172_800_000;
  const streak = keptStreak ? profile.dailyStreak + 1 : 1;
  const amount = settings.economyDailyAmount + Math.min(streak * 10, 500);

  await prisma.economyProfile.update({
    where: { guildId_userId: { guildId, userId } },
    data: { wallet: { increment: amount }, dailyStreak: streak, lastDailyAt: new Date() }
  });
  return { amount, streak };
}

export interface WorkResult {
  amount: number;
  onCooldownMs?: number;
}

export async function work(guildId: string, userId: string, settings: GuildSettings): Promise<WorkResult> {
  const profile = await getProfile(guildId, userId);
  const now = Date.now();
  if (profile.lastWorkAt && now - profile.lastWorkAt.getTime() < 3_600_000) {
    return { amount: 0, onCooldownMs: 3_600_000 - (now - profile.lastWorkAt.getTime()) };
  }
  const amount = Math.floor(Math.random() * (settings.economyWorkMax - settings.economyWorkMin + 1)) + settings.economyWorkMin;
  await prisma.economyProfile.update({ where: { guildId_userId: { guildId, userId } }, data: { wallet: { increment: amount }, lastWorkAt: new Date() } });
  return { amount };
}

export interface RobResult {
  success: boolean;
  amount: number;
  onCooldownMs?: number;
  error?: 'self' | 'too_poor' | 'target_too_poor';
}

export async function rob(guildId: string, robberId: string, targetId: string, settings: GuildSettings): Promise<RobResult> {
  if (robberId === targetId) return { success: false, amount: 0, error: 'self' };
  const robber = await getProfile(guildId, robberId);
  const target = await getProfile(guildId, targetId);

  const now = Date.now();
  if (robber.lastRobAt && now - robber.lastRobAt.getTime() < 3_600_000) {
    return { success: false, amount: 0, onCooldownMs: 3_600_000 - (now - robber.lastRobAt.getTime()) };
  }
  if (robber.wallet < 50) return { success: false, amount: 0, error: 'too_poor' };
  if (target.wallet < 50) return { success: false, amount: 0, error: 'target_too_poor' };

  const success = Math.random() < settings.economyRobSuccessRate;
  if (success) {
    const amount = Math.floor(target.wallet * (0.1 + Math.random() * 0.2));
    await prisma.$transaction([
      prisma.economyProfile.update({ where: { guildId_userId: { guildId, userId: robberId } }, data: { wallet: { increment: amount }, lastRobAt: new Date() } }),
      prisma.economyProfile.update({ where: { guildId_userId: { guildId, userId: targetId } }, data: { wallet: { decrement: amount } } })
    ]);
    return { success: true, amount };
  }

  const penalty = Math.floor(robber.wallet * 0.15);
  await prisma.economyProfile.update({ where: { guildId_userId: { guildId, userId: robberId } }, data: { wallet: { decrement: penalty }, lastRobAt: new Date() } });
  return { success: false, amount: penalty };
}

export async function deposit(guildId: string, userId: string, amount: number) {
  const profile = await getProfile(guildId, userId);
  if (amount <= 0 || amount > profile.wallet) return null;
  return prisma.economyProfile.update({ where: { guildId_userId: { guildId, userId } }, data: { wallet: { decrement: amount }, bank: { increment: amount } } });
}

export async function withdraw(guildId: string, userId: string, amount: number) {
  const profile = await getProfile(guildId, userId);
  if (amount <= 0 || amount > profile.bank) return null;
  return prisma.economyProfile.update({ where: { guildId_userId: { guildId, userId } }, data: { wallet: { increment: amount }, bank: { decrement: amount } } });
}

export async function transfer(guildId: string, fromId: string, toId: string, amount: number): Promise<boolean> {
  if (fromId === toId || amount <= 0) return false;
  const from = await getProfile(guildId, fromId);
  await getProfile(guildId, toId);
  if (from.wallet < amount) return false;
  await prisma.$transaction([
    prisma.economyProfile.update({ where: { guildId_userId: { guildId, userId: fromId } }, data: { wallet: { decrement: amount } } }),
    prisma.economyProfile.update({ where: { guildId_userId: { guildId, userId: toId } }, data: { wallet: { increment: amount } } })
  ]);
  return true;
}

export async function getEconomyLeaderboard(guildId: string, limit = 10) {
  return prisma.economyProfile.findMany({
    where: { guildId },
    orderBy: [{ wallet: 'desc' }],
    take: limit
  });
}

export async function listShopItems(guildId: string) {
  return prisma.shopItem.findMany({ where: { guildId }, orderBy: { price: 'asc' } });
}

export async function buyItem(guildId: string, userId: string, itemId: string): Promise<{ ok: boolean; error?: string; item?: Awaited<ReturnType<typeof listShopItems>>[number] }> {
  const item = await prisma.shopItem.findUnique({ where: { id: itemId } });
  if (!item || item.guildId !== guildId) return { ok: false, error: 'Item not found.' };
  if (item.stock !== null && item.stock <= 0) return { ok: false, error: 'Out of stock.' };
  const profile = await getProfile(guildId, userId);
  if (profile.wallet < item.price) return { ok: false, error: 'Not enough coins.' };

  await prisma.$transaction([
    prisma.economyProfile.update({ where: { guildId_userId: { guildId, userId } }, data: { wallet: { decrement: item.price } } }),
    prisma.inventoryItem.upsert({
      where: { profileId_itemId: { profileId: profile.id, itemId: item.id } },
      update: { quantity: { increment: 1 } },
      create: { profileId: profile.id, itemId: item.id, quantity: 1 }
    }),
    ...(item.stock !== null ? [prisma.shopItem.update({ where: { id: item.id }, data: { stock: { decrement: 1 } } })] : [])
  ]);
  return { ok: true, item };
}

export async function getInventory(guildId: string, userId: string) {
  const profile = await getProfile(guildId, userId);
  return prisma.inventoryItem.findMany({ where: { profileId: profile.id }, include: { item: true } });
}
