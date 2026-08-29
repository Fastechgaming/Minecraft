import type { Message } from 'discord.js';
import type { GuildSettings } from '@prisma/client';
import { consumeCooldown } from '../services/cooldowns';

export type AIDecision = 'RESPOND' | 'IGNORE' | 'WAIT';

const HELP_KEYWORDS = [
  'help', 'how do i', 'how to', "can't", 'cant', 'issue', 'problem', 'error', 'broken', 'not working',
  'stuck', 'bug', 'crash', 'trouble', 'confused', 'question'
];

function looksLikeHelpRequest(content: string): boolean {
  const lower = content.toLowerCase();
  if (lower.trim().endsWith('?')) return true;
  return HELP_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Decides whether the AI staff assistant should engage with a message at
 * all, *before* any AI provider is called — this is the filter that keeps
 * the bot from becoming annoying and keeps AI spend down (see AI Cost
 * Control). Only a RESPOND decision goes on to build a prompt and call
 * Gemini.
 */
export function decideAIResponse(message: Message, settings: GuildSettings, botId: string): AIDecision {
  if (!settings.aiEnabled) return 'IGNORE';
  if (message.author.bot) return 'IGNORE';

  const isConfiguredChannel = settings.aiChannelIds.length === 0 || settings.aiChannelIds.includes(message.channelId);
  if (!isConfiguredChannel) return 'IGNORE';

  const isMentioned = message.mentions.has(botId);
  const isReplyToBot = message.reference?.messageId !== undefined && message.mentions.repliedUser?.id === botId;
  const directedAtBot = isMentioned || isReplyToBot;

  if (settings.aiMentionRequired && !directedAtBot) {
    if (!settings.aiCasualConversation) return 'IGNORE';
  }

  const helpRequest = settings.aiHelpDetection && looksLikeHelpRequest(message.content);

  if (!directedAtBot && !helpRequest && !settings.aiCasualConversation) return 'IGNORE';

  const frequencySample: Record<string, number> = { low: 0.15, normal: 0.4, high: 0.75 };
  if (!directedAtBot && !helpRequest) {
    const chance = frequencySample[settings.aiResponseFrequency] ?? 0.3;
    if (Math.random() > chance) return 'IGNORE';
  }

  const userCooldownKey = `ai:user:${message.guildId}:${message.author.id}`;
  const channelCooldownKey = `ai:channel:${message.guildId}:${message.channelId}`;

  if (!consumeCooldown(channelCooldownKey, settings.aiPerChannelCooldownSec * 1000)) return 'WAIT';
  if (!consumeCooldown(userCooldownKey, settings.aiPerUserCooldownSec * 1000)) return 'WAIT';

  return 'RESPOND';
}
