import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, type Client } from 'discord.js';
import type { GuildSettings } from '@prisma/client';
import type { Content } from '@google/generative-ai';
import { prisma } from '../database/prisma';
import { chatReply } from './gemini';
import { findRelevantKnowledge } from './knowledge';
import { getMemories, getRecentConversation, recordConversationTurn } from './memory';

const MODE_PROMPTS: Record<string, string> = {
  staff: 'You are a professional, concise staff assistant for a Discord community. Stick to facts from the knowledge base when available. Keep answers short and helpful.',
  friend: 'You are a friendly, casual community member. Chat naturally, use emoji sparingly, and keep things light.',
  hybrid: 'You are a helpful community assistant. Be friendly and conversational, but give clear, accurate answers, especially about server rules or info from the knowledge base.'
};

const UNSURE_PATTERNS = [/i('| a)?m not sure/i, /i don'?t know/i, /i'?m unable to/i, /you should ask (a )?staff/i, /contact (a )?staff/i];

async function bumpUsage(guildId: string, field: 'chatMessages' | 'imagesGenerated' | 'scansPerformed' | 'escalations', amount = 1): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await prisma.aIUsage.upsert({
    where: { guildId_date: { guildId, date: today } },
    update: { [field]: { increment: amount } },
    create: { guildId, date: today, [field]: amount }
  });
}

export async function generateReply(guildId: string, userId: string, channelId: string, question: string, settings: GuildSettings): Promise<{ text: string; unsure: boolean }> {
  const [knowledge, memories, history] = await Promise.all([
    findRelevantKnowledge(guildId, question),
    getMemories(guildId, userId),
    getRecentConversation(guildId, userId, channelId)
  ]);

  const modePrompt = MODE_PROMPTS[settings.aiMode] ?? MODE_PROMPTS.hybrid;
  const personality = settings.aiPersonality ? `\nPersonality notes: ${settings.aiPersonality}` : '';
  const knowledgeBlock = knowledge.length > 0 ? `\n\nRelevant server knowledge:\n${knowledge.map((k) => `Q: ${k.question}\nA: ${k.answer}`).join('\n\n')}` : '';
  const memoryBlock = memories.length > 0 ? `\n\nThings you remember about this user:\n${memories.map((m) => `- ${m}`).join('\n')}` : '';
  const systemInstruction = `${modePrompt}${personality}${knowledgeBlock}${memoryBlock}\n\nIf you genuinely don't know the answer and it's not in the knowledge base, say so plainly rather than guessing.`;

  const historyContent: Content[] = history.map((turn) => ({ role: turn.role === 'user' ? 'user' : 'model', parts: [{ text: turn.content }] }));

  const text = await chatReply(historyContent, question, systemInstruction);

  await recordConversationTurn(guildId, userId, channelId, 'user', question);
  await recordConversationTurn(guildId, userId, channelId, 'model', text);
  await bumpUsage(guildId, 'chatMessages');

  const unsure = UNSURE_PATTERNS.some((p) => p.test(text));
  return { text, unsure };
}

export function buildEscalationComponents(escalationId: string, resolved = false) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`escalation_answer_${escalationId}`).setLabel('Answer').setStyle(ButtonStyle.Primary).setDisabled(resolved),
    new ButtonBuilder().setCustomId(`escalation_knowledge_${escalationId}`).setLabel('Add to Knowledge').setStyle(ButtonStyle.Secondary).setDisabled(resolved)
  );
}

export async function escalateToStaff(
  client: Client,
  guildId: string,
  userId: string,
  channelId: string,
  question: string,
  settings: GuildSettings
): Promise<void> {
  const escalation = await prisma.aIEscalation.create({ data: { guildId, userId, question, channelId } });
  await bumpUsage(guildId, 'escalations');

  const embed = new EmbedBuilder()
    .setTitle('🆘 AI Escalation')
    .setColor(0xed4245)
    .setDescription(question)
    .addFields({ name: 'From', value: `<@${userId}>`, inline: true }, { name: 'Channel', value: `<#${channelId}>`, inline: true });

  const targetChannelId = settings.aiEscalationChannelId ?? channelId;
  const targetChannel = await client.channels.fetch(targetChannelId).catch(() => null);
  if (targetChannel?.isTextBased() && 'send' in targetChannel) {
    const sent = await targetChannel.send({ embeds: [embed], components: [buildEscalationComponents(escalation.id)] }).catch(() => null);
    if (sent) await prisma.aIEscalation.update({ where: { id: escalation.id }, data: { messageId: sent.id } });
  }
}
