import { prisma } from '../database/prisma';

export async function getMemories(guildId: string, userId: string, limit = 10): Promise<string[]> {
  const memories = await prisma.aIMemory.findMany({ where: { guildId, userId }, orderBy: { createdAt: 'desc' }, take: limit });
  return memories.map((m) => m.fact);
}

export async function addMemory(guildId: string, userId: string, fact: string): Promise<void> {
  await prisma.user.upsert({ where: { id: userId }, update: {}, create: { id: userId, username: 'unknown' } });
  await prisma.aIMemory.create({ data: { guildId, userId, fact } });
}

export async function forgetMemories(guildId: string, userId: string): Promise<number> {
  const result = await prisma.aIMemory.deleteMany({ where: { guildId, userId } });
  return result.count;
}

export async function getRecentConversation(guildId: string, userId: string, channelId: string, limit = 10) {
  return prisma.aIConversation.findMany({ where: { guildId, userId, channelId }, orderBy: { createdAt: 'desc' }, take: limit }).then((rows) => rows.reverse());
}

export async function recordConversationTurn(guildId: string, userId: string, channelId: string, role: 'user' | 'model', content: string): Promise<void> {
  await prisma.aIConversation.create({ data: { guildId, userId, channelId, role, content } });
}
