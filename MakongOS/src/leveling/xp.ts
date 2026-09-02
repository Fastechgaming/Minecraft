import { prisma } from '../database/prisma';
import { tryConsumeCooldown } from '../services/cooldowns';

export function xpForLevel(level: number, base: number): number {
  return base * level * level;
}

export function levelFromXp(xp: number, base: number): number {
  if (xp <= 0) return 0;
  return Math.floor(Math.sqrt(xp / base));
}

export interface XpGrantResult {
  leveledUp: boolean;
  newLevel: number;
  totalXp: number;
}

async function applyGrant(guildId: string, userId: string, field: 'textXp' | 'voiceXp', amount: number, base: number): Promise<XpGrantResult> {
  const before = await prisma.xP.upsert({
    where: { guildId_userId: { guildId, userId } },
    update: {},
    create: { guildId, userId }
  });
  const beforeTotal = before.textXp + before.voiceXp;
  const beforeLevel = levelFromXp(beforeTotal, base);

  const updated = await prisma.xP.update({
    where: { guildId_userId: { guildId, userId } },
    data: {
      [field]: { increment: amount },
      ...(field === 'textXp' ? { lastMessageAt: new Date() } : { lastVoiceTickAt: new Date() })
    }
  });
  const afterTotal = updated.textXp + updated.voiceXp;
  const afterLevel = levelFromXp(afterTotal, base);

  return { leveledUp: afterLevel > beforeLevel, newLevel: afterLevel, totalXp: afterTotal };
}

export async function grantTextXp(guildId: string, userId: string, xpPerMessage: number, cooldownSec: number, levelBase: number): Promise<XpGrantResult | null> {
  if (!tryConsumeCooldown(`textxp:${guildId}:${userId}`, cooldownSec * 1000)) return null;
  return applyGrant(guildId, userId, 'textXp', xpPerMessage, levelBase);
}

export async function grantVoiceXp(guildId: string, userId: string, xpPerTick: number, levelBase: number): Promise<XpGrantResult> {
  return applyGrant(guildId, userId, 'voiceXp', xpPerTick, levelBase);
}

export interface LeaderboardEntry {
  userId: string;
  textXp: number;
  voiceXp: number;
  totalXp: number;
  level: number;
  rank: number;
}

export async function getLeaderboard(guildId: string, levelBase: number, limit = 10): Promise<LeaderboardEntry[]> {
  const rows = await prisma.xP.findMany({ where: { guildId } });
  return rows
    .map((r) => ({ userId: r.userId, textXp: r.textXp, voiceXp: r.voiceXp, totalXp: r.textXp + r.voiceXp }))
    .sort((a, b) => b.totalXp - a.totalXp)
    .slice(0, limit)
    .map((entry, i) => ({ ...entry, level: levelFromXp(entry.totalXp, levelBase), rank: i + 1 }));
}

export async function getRank(guildId: string, userId: string, levelBase: number): Promise<LeaderboardEntry> {
  const rows = await prisma.xP.findMany({ where: { guildId }, orderBy: [{ textXp: 'desc' }] });
  const sorted = rows.map((r) => ({ userId: r.userId, textXp: r.textXp, voiceXp: r.voiceXp, totalXp: r.textXp + r.voiceXp })).sort((a, b) => b.totalXp - a.totalXp);
  const index = sorted.findIndex((r) => r.userId === userId);
  const entry = index >= 0 ? sorted[index] : { userId, textXp: 0, voiceXp: 0, totalXp: 0 };
  return { ...entry, level: levelFromXp(entry.totalXp, levelBase), rank: index >= 0 ? index + 1 : sorted.length + 1 };
}
