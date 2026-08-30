import { prisma } from '../database/prisma';

export function xpForLevel(level: number, base: number): number {
  return Math.round(base * level * (level + 1) * 2.5);
}

export function levelFromXp(xp: number, base: number): number {
  let level = 0;
  while (xp >= xpForLevel(level + 1, base)) level++;
  return level;
}

export interface GrantXpResult {
  leveledUp: boolean;
  newLevel: number;
  totalXp: number;
}

export async function grantXp(guildId: string, userId: string, amount: number, base: number): Promise<GrantXpResult> {
  await prisma.user.upsert({ where: { id: userId }, create: { id: userId }, update: {} });

  const existing = await prisma.xP.findUnique({ where: { guildId_userId: { guildId, userId } } });
  const totalXp = (existing?.xp ?? 0) + amount;
  const newLevel = levelFromXp(totalXp, base);
  const leveledUp = newLevel > (existing?.level ?? 0);

  await prisma.xP.upsert({
    where: { guildId_userId: { guildId, userId } },
    create: { guildId, userId, xp: totalXp, level: newLevel, lastMessageAt: new Date() },
    update: { xp: totalXp, level: newLevel, lastMessageAt: new Date() }
  });

  return { leveledUp, newLevel, totalXp };
}

export async function getLeaderboard(guildId: string, limit = 10) {
  return prisma.xP.findMany({ where: { guildId }, orderBy: { xp: 'desc' }, take: limit });
}
