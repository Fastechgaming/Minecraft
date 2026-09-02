import type { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma';

export type AuditLogType =
  | 'moderation'
  | 'ticket'
  | 'modmail'
  | 'command'
  | 'ai'
  | 'error'
  | 'member_join'
  | 'member_leave'
  | 'giveaway'
  | 'economy'
  | 'voice_hub';

export async function logAudit(
  guildId: string,
  type: AuditLogType,
  summary: string,
  actorId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await prisma.auditLog.create({
    data: { guildId, type, summary, actorId, metadata: (metadata as Prisma.InputJsonValue) ?? undefined }
  });
}
