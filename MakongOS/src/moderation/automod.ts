import type { Message, GuildMember } from 'discord.js';
import type { GuildSettings } from '@prisma/client';
import { isStaff } from '../services/permissions';
import { logAudit } from '../services/auditLog';

const INVITE_REGEX = /(discord\.gg|discord(?:app)?\.com\/invite)\/[a-zA-Z0-9-]+/i;
const messageTimestamps = new Map<string, number[]>();

function isWhitelisted(member: GuildMember, channelId: string, settings: GuildSettings): boolean {
  if (isStaff(member, settings)) return true;
  if (settings.automodWhitelistChannelIds.includes(channelId)) return true;
  return settings.automodWhitelistRoleIds.some((roleId) => member.roles.cache.has(roleId));
}

function containsBadWord(content: string, badWords: string[]): string | null {
  const lower = content.toLowerCase();
  return badWords.find((word) => word && lower.includes(word.toLowerCase())) ?? null;
}

function trackAndCheckSpam(key: string, windowSec: number, limit: number): boolean {
  const now = Date.now();
  const windowMs = windowSec * 1000;
  const existing = (messageTimestamps.get(key) ?? []).filter((t) => now - t < windowMs);
  existing.push(now);
  messageTimestamps.set(key, existing);
  return existing.length > limit;
}

export interface AutomodResult {
  triggered: boolean;
  reason?: string;
}

/** Returns the violation found (if any) and deletes the offending message. Does not punish the member — the caller decides escalation. */
export async function runAutomod(message: Message, settings: GuildSettings): Promise<AutomodResult> {
  if (!settings.moderationEnabled || !message.inGuild() || message.author.bot) return { triggered: false };
  const member = message.member;
  if (!member) return { triggered: false };
  if (isWhitelisted(member, message.channelId, settings)) return { triggered: false };

  if (settings.automodBlockInvites && INVITE_REGEX.test(message.content)) {
    await message.delete().catch(() => undefined);
    await logAudit(message.guildId!, 'moderation', `Automod removed an invite link from ${message.author.tag}`, message.author.id);
    return { triggered: true, reason: 'Posted a Discord invite link' };
  }

  if (settings.automodBlockBadWords) {
    const hit = containsBadWord(message.content, settings.automodBadWords);
    if (hit) {
      await message.delete().catch(() => undefined);
      await logAudit(message.guildId!, 'moderation', `Automod removed a blocked word from ${message.author.tag}`, message.author.id);
      return { triggered: true, reason: 'Used a blocked word' };
    }
  }

  if (settings.automodBlockSpam) {
    const key = `${message.guildId}:${message.author.id}`;
    if (trackAndCheckSpam(key, settings.automodSpamWindowSec, settings.automodSpamMsgCount)) {
      await logAudit(message.guildId!, 'moderation', `Automod flagged spam from ${message.author.tag}`, message.author.id);
      return { triggered: true, reason: `Sent more than ${settings.automodSpamMsgCount} messages in ${settings.automodSpamWindowSec}s` };
    }
  }

  return { triggered: false };
}

const recentMessages = new Map<string, { authorId: string; mentionedIds: string[]; createdAt: number }>();

export function trackMessageForGhostPing(message: Message): void {
  if (!message.inGuild() || message.mentions.users.size === 0) return;
  recentMessages.set(message.id, {
    authorId: message.author.id,
    mentionedIds: [...message.mentions.users.keys()],
    createdAt: message.createdTimestamp
  });
  // Bound memory: drop entries older than 60s on every insert.
  const cutoff = Date.now() - 60_000;
  for (const [id, entry] of recentMessages) {
    if (entry.createdAt < cutoff) recentMessages.delete(id);
  }
}

export function checkGhostPing(messageId: string): { authorId: string; mentionedIds: string[] } | null {
  const entry = recentMessages.get(messageId);
  if (!entry) return null;
  recentMessages.delete(messageId);
  const ageMs = Date.now() - entry.createdAt;
  if (ageMs > 30_000) return null; // deleted long after posting — not a ghost ping
  return entry;
}
