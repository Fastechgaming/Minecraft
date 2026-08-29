import type { Client, TextChannel } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import { prisma } from '../database/prisma';
import { getGuildSettings } from '../database/settingsCache';
import { createLogger } from './logger';

const log = createLogger('audit');

export type AuditLogType =
  | 'moderation'
  | 'ticket'
  | 'command'
  | 'ai'
  | 'error'
  | 'member_join'
  | 'member_leave'
  | 'role_change'
  | 'channel_change'
  | 'message_delete'
  | 'message_edit'
  | 'anti_spam'
  | 'security';

interface AuditLogInput {
  guildId: string;
  type: AuditLogType;
  action: string;
  userId?: string;
  moderatorId?: string;
  channelId?: string;
  details?: Record<string, unknown>;
}

const TYPE_COLOR: Record<AuditLogType, number> = {
  moderation: 0xda373c,
  ticket: 0x5865f2,
  command: 0x949ba4,
  ai: 0x9b59b6,
  error: 0xed4245,
  member_join: 0x23a559,
  member_leave: 0xf0b232,
  role_change: 0x5865f2,
  channel_change: 0x5865f2,
  message_delete: 0xed4245,
  message_edit: 0xf0b232,
  anti_spam: 0xda373c,
  security: 0xda373c
};

export async function recordAuditLog(client: Client, input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        guildId: input.guildId,
        type: input.type,
        action: input.action,
        userId: input.userId,
        moderatorId: input.moderatorId,
        channelId: input.channelId,
        details: input.details as never
      }
    });
  } catch (err) {
    log.error('Failed to persist audit log', err);
  }

  try {
    const settings = await getGuildSettings(input.guildId);
    const channelId = input.type === 'moderation' ? settings.modLogChannelId : settings.logChannelId;
    if (!channelId) return;

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setColor(TYPE_COLOR[input.type])
      .setTitle(`${labelForType(input.type)} — ${input.action}`)
      .setTimestamp(new Date());

    const fields: { name: string; value: string; inline?: boolean }[] = [];
    if (input.userId) fields.push({ name: 'User', value: `<@${input.userId}>`, inline: true });
    if (input.moderatorId) fields.push({ name: 'Moderator', value: `<@${input.moderatorId}>`, inline: true });
    if (input.channelId) fields.push({ name: 'Channel', value: `<#${input.channelId}>`, inline: true });
    if (input.details) {
      for (const [key, value] of Object.entries(input.details)) {
        if (value === undefined || value === null) continue;
        fields.push({ name: key, value: String(value).slice(0, 1000), inline: fields.length % 3 !== 2 });
      }
    }
    if (fields.length) embed.addFields(fields.slice(0, 25));

    await (channel as TextChannel).send({ embeds: [embed] }).catch(() => undefined);
  } catch (err) {
    log.error('Failed to send audit log message', err);
  }
}

function labelForType(type: AuditLogType): string {
  return type
    .split('_')
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ');
}
