import type { Client } from 'discord.js';
import { prisma } from '../database/prisma';
import { recordAuditLog } from '../services/auditLog';

export type ModerationAction =
  | 'warn'
  | 'timeout'
  | 'kick'
  | 'ban'
  | 'unban'
  | 'softban'
  | 'purge'
  | 'slowmode'
  | 'lock'
  | 'unlock'
  | 'nickname';

interface CreateCaseInput {
  guildId: string;
  targetId: string;
  moderatorId: string;
  action: ModerationAction;
  reason?: string;
  durationSec?: number;
  metadata?: Record<string, unknown>;
}

async function ensureUser(id: string): Promise<void> {
  await prisma.user.upsert({ where: { id }, create: { id }, update: {} });
}

export async function createModerationCase(client: Client, input: CreateCaseInput) {
  await Promise.all([ensureUser(input.targetId), ensureUser(input.moderatorId)]);

  const moderationCase = await prisma.moderationCase.create({
    data: {
      guildId: input.guildId,
      targetId: input.targetId,
      moderatorId: input.moderatorId,
      action: input.action,
      reason: input.reason,
      durationSec: input.durationSec,
      metadata: input.metadata as never
    }
  });

  await recordAuditLog(client, {
    guildId: input.guildId,
    type: 'moderation',
    action: input.action,
    userId: input.targetId,
    moderatorId: input.moderatorId,
    details: {
      Reason: input.reason ?? 'No reason provided',
      ...(input.durationSec ? { Duration: `${input.durationSec}s` } : {}),
      Case: `#${moderationCase.id}`
    }
  });

  return moderationCase;
}

export async function getModerationHistory(guildId: string, userId: string, limit = 25) {
  return prisma.moderationCase.findMany({
    where: { guildId, targetId: userId },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
}

export async function addWarning(guildId: string, userId: string, moderatorId: string, reason?: string) {
  await ensureUser(userId);
  return prisma.warning.create({ data: { guildId, userId, moderatorId, reason } });
}
