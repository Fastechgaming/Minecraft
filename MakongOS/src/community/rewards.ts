import { prisma } from '../database/prisma';
import { grantXp } from './xp';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

interface ClaimResult {
  success: boolean;
  message: string;
  xpAwarded?: number;
  streak?: number;
}

export async function claimDaily(guildId: string, userId: string, xpBase: number): Promise<ClaimResult> {
  const record = await prisma.xP.findUnique({ where: { guildId_userId: { guildId, userId } } });
  const now = new Date();

  if (record?.lastDailyAt && now.getTime() - record.lastDailyAt.getTime() < DAY_MS) {
    const remainingMs = DAY_MS - (now.getTime() - record.lastDailyAt.getTime());
    const hours = Math.ceil(remainingMs / (60 * 60 * 1000));
    return { success: false, message: `⏳ You already claimed your daily reward. Try again in ${hours}h.` };
  }

  const streakBroken = !record?.lastDailyAt || now.getTime() - record.lastDailyAt.getTime() > 2 * DAY_MS;
  const newStreak = streakBroken ? 1 : (record?.streakDays ?? 0) + 1;
  const bonus = Math.min(newStreak * 10, 200);
  const xpAwarded = 50 + bonus;

  await grantXp(guildId, userId, xpAwarded, xpBase);
  await prisma.xP.update({ where: { guildId_userId: { guildId, userId } }, data: { lastDailyAt: now, streakDays: newStreak } });

  return { success: true, message: `🎁 Daily reward claimed! +${xpAwarded} XP (streak: ${newStreak} days)`, xpAwarded, streak: newStreak };
}

export async function claimWeekly(guildId: string, userId: string, xpBase: number): Promise<ClaimResult> {
  const record = await prisma.xP.findUnique({ where: { guildId_userId: { guildId, userId } } });
  const now = new Date();

  if (record?.lastWeeklyAt && now.getTime() - record.lastWeeklyAt.getTime() < WEEK_MS) {
    const remainingMs = WEEK_MS - (now.getTime() - record.lastWeeklyAt.getTime());
    const days = Math.ceil(remainingMs / DAY_MS);
    return { success: false, message: `⏳ You already claimed your weekly reward. Try again in ${days}d.` };
  }

  const xpAwarded = 300;
  await grantXp(guildId, userId, xpAwarded, xpBase);
  await prisma.xP.update({ where: { guildId_userId: { guildId, userId } }, data: { lastWeeklyAt: now } });

  return { success: true, message: `🎁 Weekly reward claimed! +${xpAwarded} XP`, xpAwarded };
}
