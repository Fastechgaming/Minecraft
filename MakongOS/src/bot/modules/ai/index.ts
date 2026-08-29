import {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
  MessageFlags,
  Events,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type GuildMember
} from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { getGuildSettings } from '../../../database/settingsCache';
import { prisma } from '../../../database/prisma';
import { geminiProvider } from '../../../providers/ai/geminiProvider';
import { decideAIResponse } from '../../../ai/decisionEngine';
import { handleStaffAssistantMessage, buildEscalationComponents } from '../../../ai/staffAssistant';
import { maybeRunAIModeration } from '../../../ai/moderationPipeline';
import { forgetUserMemory, rememberFact } from '../../../ai/memory';
import { searchKnowledge, formatKnowledgeForPrompt } from '../../../ai/knowledge';
import { isWithinLimits, incrementUsage } from '../../../ai/usage';
import { isStaff } from '../../../services/permissions';
import { consumeCooldown } from '../../../services/cooldowns';

const KNOWLEDGE_CATEGORIES = ['rules', 'faq', 'minecraft', 'commands', 'ranks', 'store', 'events', 'staff', 'punishments', 'other'];

export const aiModule: FeatureModule = {
  name: 'ai',
  description: 'Gemini-powered virtual staff member: chat, image understanding, image generation, escalation.',
  commands: [
    {
      data: new SlashCommandBuilder()
        .setName('ai')
        .setDescription('Talk to the MakongOS AI staff assistant.')
        .addSubcommand((sub) => sub.setName('ask').setDescription('Ask the AI a question.').addStringOption((o) => o.setName('question').setDescription('Your question').setRequired(true)))
        .addSubcommand((sub) =>
          sub
            .setName('image')
            .setDescription('Generate an image with AI.')
            .addStringOption((o) => o.setName('prompt').setDescription('What to generate').setRequired(true))
        )
        .addSubcommand((sub) => sub.setName('forget').setDescription('Delete everything the AI remembers about you.')),
      module: 'ai',
      defaultCooldownSec: 5,
      execute: async (interaction) => {
        if (!interaction.guildId) return;
        const settings = await getGuildSettings(interaction.guildId);
        if (!settings.aiEnabled) {
          await interaction.reply({ content: '🚫 The AI assistant is disabled on this server.', flags: MessageFlags.Ephemeral });
          return;
        }
        const sub = interaction.options.getSubcommand();

        if (sub === 'ask') {
          const question = interaction.options.getString('question', true);
          const key = `ai:user:${interaction.guildId}:${interaction.user.id}`;
          if (!consumeCooldown(key, settings.aiPerUserCooldownSec * 1000)) {
            await interaction.reply({ content: '⏳ Slow down a little before asking again.', flags: MessageFlags.Ephemeral });
            return;
          }
          const withinLimits = await isWithinLimits(interaction.guildId, settings.aiDailyLimit, settings.aiMonthlyLimit);
          if (!withinLimits) {
            await interaction.reply({ content: '🚫 The AI has hit its usage limit for today. Try again later.', flags: MessageFlags.Ephemeral });
            return;
          }

          await interaction.deferReply();
          const knowledge = await searchKnowledge(interaction.guildId, question);
          await incrementUsage(interaction.guildId, 'messagesAnalyzed');
          const answer = await geminiProvider
            .chat({
              systemPrompt: `You are a helpful Discord staff assistant for a Minecraft server. Use this knowledge base:\n${formatKnowledgeForPrompt(knowledge)}`,
              history: [],
              userMessage: question
            })
            .catch(() => "Sorry, I couldn't reach the AI provider right now.");
          await incrementUsage(interaction.guildId, 'responses');
          await interaction.editReply(answer);
          return;
        }

        if (sub === 'image') {
          if (!settings.aiImageGeneration) {
            await interaction.reply({ content: '🚫 AI image generation is disabled on this server.', flags: MessageFlags.Ephemeral });
            return;
          }
          const key = `ai:image:${interaction.guildId}:${interaction.user.id}`;
          if (!consumeCooldown(key, 30_000)) {
            await interaction.reply({ content: '⏳ Please wait before generating another image.', flags: MessageFlags.Ephemeral });
            return;
          }
          await interaction.deferReply();
          const prompt = interaction.options.getString('prompt', true);
          try {
            const buffer = await geminiProvider.generateImage({ prompt });
            await incrementUsage(interaction.guildId, 'imagesGenerated');
            const attachment = new AttachmentBuilder(buffer, { name: 'ai-image.png' });
            const embed = new EmbedBuilder().setColor(0x9b59b6).setTitle('🎨 AI Generated Image').setDescription(prompt).setImage('attachment://ai-image.png');
            await interaction.editReply({ embeds: [embed], files: [attachment] });
          } catch (err) {
            await interaction.editReply(`❌ Image generation failed: ${(err as Error).message}`);
          }
          return;
        }

        if (sub === 'forget') {
          await forgetUserMemory(interaction.guildId, interaction.user.id);
          await interaction.reply({ content: '🧹 I have forgotten everything I remembered about you.', flags: MessageFlags.Ephemeral });
        }
      }
    }
  ],
  events: [
    {
      event: Events.MessageCreate,
      handler: async (message) => {
        if (!message.guildId || message.author.bot) return;

        await maybeRunAIModeration(message).catch(() => undefined);

        const settings = await getGuildSettings(message.guildId);
        const botId = message.client.user?.id;
        if (!botId) return;

        const decision = decideAIResponse(message, settings, botId);
        if (decision !== 'RESPOND') return;

        await handleStaffAssistantMessage(message).catch(() => undefined);

        const mcMatch = message.content.match(/my (?:minecraft|mc) (?:username|name|ign) is\s+(\w{2,16})/i);
        if (mcMatch && settings.aiMemoryEnabled) {
          await rememberFact(message.guildId, message.author.id, 'minecraft_username', mcMatch[1]!, settings.aiMemoryDurationHours);
        }
      }
    }
  ],
  components: [
    {
      prefix: 'escalation_answer_',
      button: async (interaction) => {
        if (!interaction.guildId) return;
        const settings = await getGuildSettings(interaction.guildId);
        if (!isStaff(interaction.member as GuildMember, settings)) {
          await interaction.reply({ content: '🚫 Only staff can answer escalations.', flags: MessageFlags.Ephemeral });
          return;
        }
        const escalationId = interaction.customId.replace('escalation_answer_', '');
        const modal = new ModalBuilder()
          .setCustomId(`escalation_answer_modal_${escalationId}`)
          .setTitle('Answer this escalation')
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('answer')
                .setLabel('Your answer (sent to the member)')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(1800)
            )
          );
        await interaction.showModal(modal);
      },
      modal: async (interaction) => {
        if (!interaction.customId.startsWith('escalation_answer_modal_') || !interaction.guildId) return;
        const escalationId = interaction.customId.replace('escalation_answer_modal_', '');
        const answer = interaction.fields.getTextInputValue('answer');

        const escalation = await prisma.aIEscalation.findUnique({ where: { id: escalationId } });
        if (!escalation) {
          await interaction.reply({ content: '❌ This escalation no longer exists.', flags: MessageFlags.Ephemeral });
          return;
        }

        await prisma.aIEscalation.update({
          where: { id: escalationId },
          data: { status: 'answered', answeredById: interaction.user.id, answer, answeredAt: new Date() }
        });

        if (interaction.isFromMessage()) {
          const embed = EmbedBuilder.from(interaction.message.embeds[0]!)
            .addFields({ name: `✅ Answered by ${interaction.user.tag}`, value: answer.slice(0, 1000) })
            .setColor(0x23a559);
          await interaction.update({ embeds: [embed], components: [buildEscalationComponents(escalationId, true)] });
        } else {
          await interaction.reply({ content: '✅ Answer sent.', flags: MessageFlags.Ephemeral });
        }

        const channel = await interaction.guild!.channels.fetch(escalation.channelId).catch(() => null);
        if (channel?.isTextBased()) {
          await channel
            .send(`<@${escalation.userId}> Staff followed up on your question: **${escalation.question.slice(0, 200)}**\n\n${answer}`)
            .catch(() => undefined);
        } else {
          const user = await interaction.client.users.fetch(escalation.userId).catch(() => null);
          await user?.send(`Staff followed up on your question in **${interaction.guild!.name}**:\n\n${answer}`).catch(() => undefined);
        }
      }
    },
    {
      prefix: 'escalation_knowledge_',
      button: async (interaction) => {
        if (!interaction.guildId) return;
        const settings = await getGuildSettings(interaction.guildId);
        if (!isStaff(interaction.member as GuildMember, settings)) {
          await interaction.reply({ content: '🚫 Only staff can update the knowledge base.', flags: MessageFlags.Ephemeral });
          return;
        }
        const escalationId = interaction.customId.replace('escalation_knowledge_', '');
        const escalation = await prisma.aIEscalation.findUnique({ where: { id: escalationId } });

        const modal = new ModalBuilder()
          .setCustomId(`escalation_knowledge_modal_${escalationId}`)
          .setTitle('Teach the AI')
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('title')
                .setLabel('Title')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setValue(escalation?.question.slice(0, 100) ?? '')
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('category')
                .setLabel('Category')
                .setPlaceholder(KNOWLEDGE_CATEGORIES.join('/'))
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setValue('faq')
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('content')
                .setLabel('Content the AI should know')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(1800)
            )
          );
        await interaction.showModal(modal);
      },
      modal: async (interaction) => {
        if (!interaction.customId.startsWith('escalation_knowledge_modal_') || !interaction.guildId) return;
        const title = interaction.fields.getTextInputValue('title');
        const category = interaction.fields.getTextInputValue('category').trim().toLowerCase() || 'other';
        const content = interaction.fields.getTextInputValue('content');

        await prisma.knowledgeBase.create({
          data: { guildId: interaction.guildId, category, title, content, keywords: [] }
        });

        if (interaction.isFromMessage()) {
          const embed = EmbedBuilder.from(interaction.message.embeds[0]!).addFields({
            name: `📚 Added to knowledge base by ${interaction.user.tag}`,
            value: `**${title}** (${category})`
          });
          await interaction.update({ embeds: [embed], components: interaction.message.components as never });
        } else {
          await interaction.reply({ content: '📚 Added to the knowledge base.', flags: MessageFlags.Ephemeral });
        }
      }
    }
  ]
};
