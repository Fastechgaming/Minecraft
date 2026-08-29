import type { Message } from 'discord.js';
import type { GuildSettings } from '@prisma/client';
import { geminiProvider } from '../providers/ai/geminiProvider';
import { getGuildSettings } from '../database/settingsCache';
import { createModerationCase } from '../moderation/service';
import { recordAuditLog } from '../services/auditLog';
import { incrementUsage } from './usage';
import { createLogger } from '../services/logger';

const log = createLogger('ai-moderation');

const RISK_SIGNS = [/http/i, /discord\.gg/i, /kill (yourself|urself|u)/i, /\bfree nitro\b/i, /\bhate\b/i, /\bslur\b/i];

function needsClassification(content: string): boolean {
  if (content.length < 8) return false;
  return RISK_SIGNS.some((r) => r.test(content)) || content.split(/\s+/).length > 25;
}

export async function maybeRunAIModeration(message: Message): Promise<void> {
  if (!message.guildId || message.author.bot) return;
  const settings: GuildSettings = await getGuildSettings(message.guildId);
  if (!settings.aiEnabled || !settings.aiAutoModEnabled) return;
  if (!needsClassification(message.content)) return;

  await incrementUsage(message.guildId, 'messagesAnalyzed');

  let classification;
  try {
    classification = await geminiProvider.classifyModeration(message.content);
  } catch (err) {
    log.error('Classification failed', err);
    return;
  }

  if (classification.category === 'none' || classification.confidence < settings.aiAutoModMedConfidence) {
    return; // low confidence → ignore/monitor
  }

  if (classification.confidence < settings.aiAutoModHighConfidence) {
    // medium confidence → alert moderators only, never auto-punish
    await incrementUsage(message.guildId, 'moderationAlerts');
    await recordAuditLog(message.client, {
      guildId: message.guildId,
      type: 'ai',
      action: 'moderation_alert',
      userId: message.author.id,
      channelId: message.channelId,
      details: {
        Category: classification.category,
        Confidence: `${Math.round(classification.confidence * 100)}%`,
        Explanation: classification.explanation,
        Message: message.content.slice(0, 500)
      }
    });
    return;
  }

  // high confidence → configured automatic action
  await message.delete().catch(() => undefined);
  const member = message.member;
  if (member) {
    if (settings.aiAutoModAction === 'timeout') {
      await member.timeout(10 * 60_000, `AI moderation: ${classification.category}`).catch(() => undefined);
    } else if (settings.aiAutoModAction === 'kick') {
      await member.kick(`AI moderation: ${classification.category}`).catch(() => undefined);
    } else if (settings.aiAutoModAction === 'ban') {
      await member.ban({ reason: `AI moderation: ${classification.category}` }).catch(() => undefined);
    }
  }

  await createModerationCase(message.client, {
    guildId: message.guildId,
    targetId: message.author.id,
    moderatorId: message.client.user!.id,
    action: settings.aiAutoModAction === 'warn' ? 'warn' : (settings.aiAutoModAction as never),
    reason: `AI moderation (${Math.round(classification.confidence * 100)}% confidence): ${classification.category} — ${classification.explanation}`
  });
}
