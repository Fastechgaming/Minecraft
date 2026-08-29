import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type Message, type TextChannel } from 'discord.js';
import type { GuildSettings } from '@prisma/client';
import { geminiProvider } from '../providers/ai/geminiProvider';
import { getGuildSettings } from '../database/settingsCache';
import { prisma } from '../database/prisma';
import { searchKnowledge, formatKnowledgeForPrompt } from './knowledge';
import { getMemories, formatMemoryForPrompt, getRecentConversation, saveConversationTurn } from './memory';
import { isWithinLimits, incrementUsage } from './usage';
import { createLogger } from '../services/logger';
import { createTicketChannel } from '../tickets/service';

const log = createLogger('ai-staff');

const MODE_PROMPTS: Record<string, string> = {
  staff:
    'You are a friendly, helpful staff member for a Minecraft server Discord community. Answer questions, explain rules, ' +
    'guide new members, and direct users to the right channel or command. Be concise and warm.',
  moderator:
    'You are a careful, authoritative Discord moderator assistant. Be precise, calm and professional. Do not make accusations; ' +
    'only describe what you observe and suggest next steps to human staff.',
  friend:
    'You are a casual, fun community member bot. Joke around, be friendly, talk about Minecraft, and keep replies short and playful.',
  hybrid:
    'You are MakongOS, a virtual staff member for a Minecraft server Discord. Blend helpfulness with a friendly tone: answer ' +
    'questions and help players, but keep things light when the conversation is casual.'
};

function buildSystemPrompt(settings: GuildSettings, knowledgeText: string, memoryText: string): string {
  const base = MODE_PROMPTS[settings.aiMode] ?? MODE_PROMPTS.staff;
  return `${base}

SERVER KNOWLEDGE BASE (use this to answer accurately; do not invent server-specific facts not listed here):
${knowledgeText}

WHAT YOU REMEMBER ABOUT THIS USER:
${memoryText}

RULES:
- Keep replies under 300 words.
- If you are not confident you can correctly resolve the user's problem (e.g. billing/payment issues, punishment appeals, bugs you cannot verify), respond with EXACTLY: "NEED_STAFF: <one line reason>" and nothing else.
- Never claim to take moderation action yourself — only human staff can warn, timeout, kick or ban.
- Do not make up Minecraft server details that are not in the knowledge base above.`;
}

export async function handleStaffAssistantMessage(message: Message): Promise<void> {
  if (!message.guildId) return;
  const settings = await getGuildSettings(message.guildId);

  const withinLimits = await isWithinLimits(message.guildId, settings.aiDailyLimit, settings.aiMonthlyLimit);
  if (!withinLimits) {
    log.warn(`AI usage limit reached for guild ${message.guildId}`);
    return;
  }

  await incrementUsage(message.guildId, 'messagesAnalyzed');

  const [knowledgeEntries, memories, history] = await Promise.all([
    searchKnowledge(message.guildId, message.content),
    settings.aiMemoryEnabled ? getMemories(message.guildId, message.author.id) : Promise.resolve({}),
    getRecentConversation(message.guildId, message.channelId, message.author.id, settings.aiMaxHistoryMessages)
  ]);

  const systemPrompt = buildSystemPrompt(settings, formatKnowledgeForPrompt(knowledgeEntries), formatMemoryForPrompt(memories));
  const imageUrls = settings.aiImageUnderstanding
    ? [...message.attachments.values()].filter((a) => a.contentType?.startsWith('image/')).map((a) => a.url)
    : [];

  if (imageUrls.length) await incrementUsage(message.guildId, 'imageAnalyses');

  const channel = message.channel as TextChannel;

  let response: string;
  try {
    await channel.sendTyping().catch(() => undefined);
    response = await geminiProvider.chat({
      systemPrompt,
      history: history.map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      userMessage: message.content || 'The user sent an attachment with no text.',
      imageUrls
    });
  } catch (err) {
    log.error('AI chat failed', err);
    return;
  }

  await saveConversationTurn(message.guildId, message.channelId, message.author.id, 'user', message.content, settings.aiMode, imageUrls);

  if (response.startsWith('NEED_STAFF:')) {
    const reason = response.replace('NEED_STAFF:', '').trim();
    await escalateToStaff(message, settings, reason, history.map((h) => `${h.role}: ${h.content}`).join('\n'));
    await message.reply("I've looped in the staff team — someone will follow up with you shortly! 🙋").catch(() => undefined);
    await saveConversationTurn(message.guildId, message.channelId, message.author.id, 'assistant', '[escalated to staff]', settings.aiMode);
    return;
  }

  await incrementUsage(message.guildId, 'responses');
  await saveConversationTurn(message.guildId, message.channelId, message.author.id, 'assistant', response, settings.aiMode);

  const chunks = response.match(/[\s\S]{1,1900}/g) ?? [response];
  for (const chunk of chunks) {
    await message.reply(chunk).catch(() => channel.send(chunk));
  }
}

export function buildEscalationComponents(escalationId: string, resolved = false) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`escalation_answer_${escalationId}`)
      .setLabel('Answer')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success)
      .setDisabled(resolved),
    new ButtonBuilder()
      .setCustomId(`escalation_knowledge_${escalationId}`)
      .setLabel('Add to Knowledge')
      .setEmoji('📚')
      .setStyle(ButtonStyle.Secondary)
  );
}

export async function escalateToStaff(message: Message, settings: GuildSettings, reason: string, transcript: string): Promise<void> {
  if (!settings.aiStaffEscalation || !message.guildId) return;
  await incrementUsage(message.guildId, 'escalations');

  const escalation = await prisma.aIEscalation.create({
    data: {
      guildId: message.guildId,
      userId: message.author.id,
      channelId: message.channelId,
      question: message.content || '(no text — attachment only)',
      reason: reason || 'AI could not confidently resolve this request.',
      transcript: transcript || 'No prior context.'
    }
  });

  const embed = new EmbedBuilder()
    .setColor(0xda373c)
    .setTitle('🚨 AI Staff Escalation')
    .addFields(
      { name: 'User', value: `${message.author}`, inline: true },
      { name: 'Channel', value: `${message.channel}`, inline: true },
      { name: 'Reason', value: reason || 'AI could not confidently resolve this request.' },
      { name: 'Question', value: (message.content || '(no text — attachment only)').slice(0, 1000) },
      { name: 'AI Summary', value: transcript.slice(-900) || 'No prior context.' }
    )
    .setFooter({ text: `Escalation #${escalation.id}` })
    .setTimestamp(new Date());

  const components = [buildEscalationComponents(escalation.id)];

  if (settings.aiEscalationChannel) {
    const channel = await message.guild!.channels.fetch(settings.aiEscalationChannel).catch(() => null);
    if (channel?.isTextBased()) {
      await (channel as TextChannel).send({ embeds: [embed], components }).catch(() => undefined);
      return;
    }
  }

  // Fall back to opening a ticket for the user if no escalation channel is configured.
  try {
    const { channel } = await createTicketChannel(message.guild!, null, { id: message.author.id, username: message.author.username });
    await channel.send({ embeds: [embed], components });
  } catch (err) {
    log.error('Failed to escalate to staff', err);
  }
}
