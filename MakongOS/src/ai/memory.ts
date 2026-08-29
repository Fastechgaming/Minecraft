import { prisma } from '../database/prisma';

export async function rememberFact(guildId: string, userId: string, key: string, value: string, durationHours: number): Promise<void> {
  await prisma.user.upsert({ where: { id: userId }, create: { id: userId }, update: {} });
  const expiresAt = durationHours > 0 ? new Date(Date.now() + durationHours * 60 * 60 * 1000) : null;
  await prisma.aIMemory.upsert({
    where: { guildId_userId_key: { guildId, userId, key } },
    create: { guildId, userId, key, value, expiresAt },
    update: { value, expiresAt }
  });
}

export async function getMemories(guildId: string, userId: string): Promise<Record<string, string>> {
  const rows = await prisma.aIMemory.findMany({
    where: { guildId, userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }
  });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function formatMemoryForPrompt(memories: Record<string, string>): string {
  const entries = Object.entries(memories);
  if (entries.length === 0) return 'No stored memory for this user yet.';
  return entries.map(([key, value]) => `${key}: ${value}`).join('\n');
}

export async function forgetUserMemory(guildId: string, userId: string): Promise<void> {
  await prisma.aIMemory.deleteMany({ where: { guildId, userId } });
}

export async function getRecentConversation(guildId: string, channelId: string, userId: string, limit: number) {
  const rows = await prisma.aIConversation.findMany({
    where: { guildId, channelId, userId },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
  return rows.reverse();
}

export async function saveConversationTurn(
  guildId: string,
  channelId: string,
  userId: string,
  role: 'user' | 'assistant',
  content: string,
  mode: string,
  imageUrls: string[] = []
): Promise<void> {
  await prisma.aIConversation.create({ data: { guildId, channelId, userId, role, content, mode, imageUrls } });
}
