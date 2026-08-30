import { prisma } from '../database/prisma';

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

type UsageField = 'messagesAnalyzed' | 'responses' | 'imageAnalyses' | 'imagesGenerated' | 'escalations';

export async function incrementUsage(guildId: string, field: UsageField, amount = 1): Promise<void> {
  const date = todayUtc();
  await prisma.aIUsage.upsert({
    where: { guildId_date: { guildId, date } },
    create: { guildId, date, [field]: amount },
    update: { [field]: { increment: amount } }
  });
}

export async function getTodayUsage(guildId: string) {
  const date = todayUtc();
  return prisma.aIUsage.findUnique({ where: { guildId_date: { guildId, date } } });
}

export async function getMonthUsageTotal(guildId: string): Promise<number> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const rows = await prisma.aIUsage.findMany({ where: { guildId, date: { gte: monthStart } } });
  return rows.reduce((sum, r) => sum + r.responses + r.imagesGenerated, 0);
}

export async function isWithinLimits(guildId: string, dailyLimit: number, monthlyLimit: number): Promise<boolean> {
  const [today, monthTotal] = await Promise.all([getTodayUsage(guildId), getMonthUsageTotal(guildId)]);
  if (today && today.responses >= dailyLimit) return false;
  if (monthTotal >= monthlyLimit) return false;
  return true;
}
