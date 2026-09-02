import type { GuildMember, User } from 'discord.js';
import { prisma } from '../database/prisma';
import { logAudit } from '../services/auditLog';

export type CaseType = 'warn' | 'timeout' | 'kick' | 'ban' | 'unban' | 'untimeout' | 'antiscam';

export async function createCase(
  guildId: string,
  type: CaseType,
  target: { id: string; tag: string },
  moderator: { id: string; tag: string },
  reason?: string
) {
  const result = await prisma.$transaction(async (tx) => {
    const last = await tx.moderationCase.findFirst({ where: { guildId }, orderBy: { caseNumber: 'desc' } });
    const caseNumber = (last?.caseNumber ?? 0) + 1;
    return tx.moderationCase.create({
      data: {
        guildId,
        caseNumber,
        type,
        targetId: target.id,
        targetTag: target.tag,
        moderatorId: moderator.id,
        moderatorTag: moderator.tag,
        reason
      }
    });
  });

  await logAudit(guildId, 'moderation', `Case #${result.caseNumber}: ${type} — ${target.tag}`, moderator.id, {
    caseNumber: result.caseNumber,
    type,
    targetId: target.id,
    reason
  });

  return result;
}

export function tagOf(user: User | GuildMember): string {
  const u = 'user' in user ? user.user : user;
  return u.discriminator && u.discriminator !== '0' ? `${u.username}#${u.discriminator}` : u.username;
}
