import { prisma } from '../database/prisma';

export async function recordGameResult(guildId: string, userId: string, game: string, result: 'win' | 'loss' | 'draw'): Promise<void> {
  await prisma.user.upsert({ where: { id: userId }, create: { id: userId }, update: {} });
  await prisma.gameStats.upsert({
    where: { guildId_userId_game: { guildId, userId, game } },
    create: {
      guildId,
      userId,
      game,
      wins: result === 'win' ? 1 : 0,
      losses: result === 'loss' ? 1 : 0,
      draws: result === 'draw' ? 1 : 0,
      score: result === 'win' ? 1 : 0
    },
    update: {
      wins: { increment: result === 'win' ? 1 : 0 },
      losses: { increment: result === 'loss' ? 1 : 0 },
      draws: { increment: result === 'draw' ? 1 : 0 },
      score: { increment: result === 'win' ? 1 : 0 }
    }
  });
}

export async function getLeaderboard(guildId: string, game?: string, limit = 10) {
  return prisma.gameStats.groupBy({
    by: ['userId'],
    where: { guildId, ...(game ? { game } : {}) },
    _sum: { wins: true },
    orderBy: { _sum: { wins: 'desc' } },
    take: limit
  });
}
