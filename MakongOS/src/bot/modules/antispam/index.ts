import { Events, EmbedBuilder, type Message, type GuildMember, type TextChannel } from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { getGuildSettings } from '../../../database/settingsCache';
import { prisma } from '../../../database/prisma';
import { recordAuditLog } from '../../../services/auditLog';
import { createModerationCase } from '../../../moderation/service';
import { automationEngine } from '../../../automation/engine';

interface UserHistory {
  timestamps: number[];
  contents: string[];
  mentionSpamAt: number[];
}

const history = new Map<string, UserHistory>();
const INVITE_REGEX = /discord(?:\.gg|app\.com\/invite|\.com\/invite)\/[a-z0-9-]+/i;
const LINK_REGEX = /https?:\/\/\S+/gi;

function getHistory(key: string): UserHistory {
  let h = history.get(key);
  if (!h) {
    h = { timestamps: [], contents: [], mentionSpamAt: [] };
    history.set(key, h);
  }
  return h;
}

function scoreMessage(message: Message, h: UserHistory): { score: number; reasons: string[] } {
  const now = Date.now();
  const content = message.content;
  let score = 0;
  const reasons: string[] = [];

  h.timestamps = h.timestamps.filter((t) => now - t < 8000);
  h.timestamps.push(now);
  h.contents = h.contents.slice(-5);

  if (h.timestamps.length >= 6) {
    score += 40;
    reasons.push('message flooding');
  } else if (h.timestamps.length >= 4) {
    score += 20;
    reasons.push('rapid messages');
  }

  const duplicateCount = h.contents.filter((c) => c === content && content.length > 0).length;
  if (duplicateCount >= 2) {
    score += 30;
    reasons.push('duplicate messages');
  }
  h.contents.push(content);

  if (content.length > 12) {
    const letters = content.replace(/[^a-zA-Z]/g, '');
    const upper = content.replace(/[^A-Z]/g, '');
    if (letters.length > 0 && upper.length / letters.length > 0.7) {
      score += 15;
      reasons.push('excessive caps');
    }
  }

  const emojiCount = (content.match(/<a?:\w+:\d+>|\p{Extended_Pictographic}/gu) ?? []).length;
  if (emojiCount >= 8) {
    score += 15;
    reasons.push('excessive emojis');
  }

  if (message.mentions.users.size + message.mentions.roles.size >= 5) {
    score += 35;
    reasons.push('mention spam');
  }

  if (INVITE_REGEX.test(content)) {
    score += 40;
    reasons.push('discord invite link');
  } else if (LINK_REGEX.test(content)) {
    score += 15;
    reasons.push('link posted');
  }

  return { score: Math.min(score, 100), reasons };
}

function isWhitelisted(member: GuildMember, channelId: string, settings: { spamWhitelistUserIds: string[]; spamWhitelistRoleIds: string[]; spamWhitelistChanIds: string[] }): boolean {
  if (member.user.bot) return true;
  if (settings.spamWhitelistUserIds.includes(member.id)) return true;
  if (settings.spamWhitelistChanIds.includes(channelId)) return true;
  return settings.spamWhitelistRoleIds.some((id) => member.roles.cache.has(id));
}

export const antiSpamModule: FeatureModule = {
  name: 'antispam',
  description: 'Configurable scoring engine that detects flooding, duplicates, caps, mention/link/invite spam.',
  events: [
    {
      event: Events.MessageCreate,
      handler: async (message) => {
        if (!message.guildId || !message.member || message.author.bot) return;

        const settings = await getGuildSettings(message.guildId);
        if (!settings.antiSpamEnabled) return;
        if (isWhitelisted(message.member, message.channelId, settings)) return;

        const key = `${message.guildId}:${message.author.id}`;
        const h = getHistory(key);
        const { score, reasons } = scoreMessage(message, h);
        if (score < settings.spamWarnThreshold) return;

        let action: 'warning' | 'timeout' | 'ban' = 'warning';
        if (score >= settings.spamBanThreshold) action = 'ban';
        else if (score >= settings.spamActionThreshold) action = 'timeout';

        await prisma.antiSpamHit.create({
          data: {
            guildId: message.guildId,
            userId: message.author.id,
            channelId: message.channelId,
            score,
            action,
            reason: reasons.join(', ')
          }
        });

        if (action !== 'warning') {
          await message.delete().catch(() => undefined);
        }

        if (action === 'timeout') {
          await message.member.timeout(10 * 60_000, `Anti-spam: ${reasons.join(', ')}`).catch(() => undefined);
          await createModerationCase(message.client, {
            guildId: message.guildId,
            targetId: message.author.id,
            moderatorId: message.client.user!.id,
            action: 'timeout',
            reason: `Anti-spam auto-action: ${reasons.join(', ')}`,
            durationSec: 600
          });
        } else if (action === 'ban') {
          await message.guild!.members.ban(message.author.id, { reason: `Anti-spam: ${reasons.join(', ')}` }).catch(() => undefined);
          await createModerationCase(message.client, {
            guildId: message.guildId,
            targetId: message.author.id,
            moderatorId: message.client.user!.id,
            action: 'ban',
            reason: `Anti-spam auto-action: ${reasons.join(', ')}`
          });
        }

        await recordAuditLog(message.client, {
          guildId: message.guildId,
          type: 'anti_spam',
          action,
          userId: message.author.id,
          channelId: message.channelId,
          details: { Score: score, Reasons: reasons.join(', ') }
        });

        if (action === 'warning') {
          const embed = new EmbedBuilder()
            .setColor(0xf0b232)
            .setDescription(`⚠️ ${message.author}, please slow down (${reasons.join(', ')}).`);
          const warnMsg = await (message.channel as TextChannel).send({ embeds: [embed] });
          setTimeout(() => warnMsg.delete().catch(() => undefined), 6000);
        }

        if (score >= settings.spamActionThreshold) {
          await automationEngine.trigger(message.client, 'ai_high_confidence_spam', {
            guildId: message.guildId,
            userId: message.author.id,
            channelId: message.channelId,
            data: { score, reasons: reasons.join(', ') }
          });
        }
      }
    }
  ]
};
