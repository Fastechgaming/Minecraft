import {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { prisma } from '../../../database/prisma';
import { getGuildSettings } from '../../../database/settingsCache';
import { isStaff } from '../../../services/permissions';
import { generateReply, escalateToStaff, buildEscalationComponents } from '../../../ai/staffAssistant';
import { forgetMemories } from '../../../ai/memory';
import { isPromptSafe, generateImage } from '../../../ai/pollinations';

async function respondInChannel(message: import('discord.js').Message, settings: import('@prisma/client').GuildSettings) {
  if (!message.inGuild()) return;
  const question = message.content.replace(/<@!?\d+>/g, '').trim();
  if (!question) return;

  await message.channel.sendTyping().catch(() => undefined);
  const { text, unsure } = await generateReply(message.guildId, message.author.id, message.channelId, question, settings);
  await message.reply(text.slice(0, 2000)).catch(() => undefined);

  if (unsure) await escalateToStaff(message.client, message.guildId, message.author.id, message.channelId, question, settings);
}

export const aiModule: FeatureModule = {
  name: 'ai',
  description: 'Gemini-powered chat assistant with knowledge base, memory, and staff escalation, plus free AI image generation.',
  commands: [
    {
      data: new SlashCommandBuilder().setName('ask').setDescription('Ask the AI assistant a question').addStringOption((o) => o.setName('question').setDescription('Your question').setRequired(true)),
      execute: async (interaction) => {
        const settings = await getGuildSettings(interaction.guildId!);
        if (!settings.aiEnabled) {
          await interaction.reply({ content: 'The AI assistant is disabled on this server.', ephemeral: true });
          return;
        }
        await interaction.deferReply();
        const question = interaction.options.getString('question', true);
        const { text, unsure } = await generateReply(interaction.guildId!, interaction.user.id, interaction.channelId, question, settings);
        await interaction.editReply(text.slice(0, 2000));
        if (unsure) await escalateToStaff(interaction.client, interaction.guildId!, interaction.user.id, interaction.channelId, question, settings);
      }
    },
    {
      data: new SlashCommandBuilder().setName('imagine').setDescription('Generate an AI image').addStringOption((o) => o.setName('prompt').setDescription('Describe the image').setRequired(true)),
      execute: async (interaction) => {
        const settings = await getGuildSettings(interaction.guildId!);
        if (!settings.aiEnabled) {
          await interaction.reply({ content: 'The AI assistant is disabled on this server.', ephemeral: true });
          return;
        }
        const prompt = interaction.options.getString('prompt', true);
        if (!isPromptSafe(prompt)) {
          await interaction.reply({ content: '🚫 That prompt was blocked by the NSFW safety filter.', ephemeral: true });
          return;
        }
        await interaction.deferReply();
        try {
          const image = await generateImage(prompt);
          await prisma.aIUsage.upsert({
            where: { guildId_date: { guildId: interaction.guildId!, date: new Date(new Date().setHours(0, 0, 0, 0)) } },
            update: { imagesGenerated: { increment: 1 } },
            create: { guildId: interaction.guildId!, date: new Date(new Date().setHours(0, 0, 0, 0)), imagesGenerated: 1 }
          });
          const embed = new EmbedBuilder().setTitle('🎨 Generated Image').setDescription(prompt.slice(0, 200)).setImage('attachment://image.png').setColor(0x5865f2);
          await interaction.editReply({ embeds: [embed], files: [new AttachmentBuilder(image.buffer, { name: 'image.png' })] });
        } catch {
          await interaction.editReply('❌ Image generation failed — try a different prompt.');
        }
      }
    },
    {
      data: new SlashCommandBuilder().setName('ai-forget').setDescription('Make the AI forget everything it remembers about you'),
      execute: async (interaction) => {
        const count = await forgetMemories(interaction.guildId!, interaction.user.id);
        await interaction.reply({ content: `🧹 Forgot ${count} remembered fact(s) about you.`, ephemeral: true });
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('knowledge')
        .setDescription('Manage the AI knowledge base')
        .addSubcommand((s) =>
          s
            .setName('add')
            .setDescription('Add a knowledge entry')
            .addStringOption((o) => o.setName('question').setDescription('Question').setRequired(true))
            .addStringOption((o) => o.setName('answer').setDescription('Answer').setRequired(true))
            .addStringOption((o) => o.setName('category').setDescription('Category').setRequired(false))
        )
        .addSubcommand((s) => s.setName('list').setDescription('List knowledge entries'))
        .addSubcommand((s) => s.setName('remove').setDescription('Remove a knowledge entry').addStringOption((o) => o.setName('id').setDescription('Entry ID from /knowledge list').setRequired(true))),
      execute: async (interaction) => {
        const settings = await getGuildSettings(interaction.guildId!);
        const member = interaction.member;
        if (!member || !('roles' in member) || !isStaff(member as never, settings)) {
          await interaction.reply({ content: 'You need a staff role to manage the knowledge base.', ephemeral: true });
          return;
        }
        const sub = interaction.options.getSubcommand();

        if (sub === 'add') {
          const question = interaction.options.getString('question', true);
          const answer = interaction.options.getString('answer', true);
          const category = interaction.options.getString('category') ?? 'general';
          await prisma.knowledgeBase.create({ data: { guildId: interaction.guildId!, question, answer, category, addedById: interaction.user.id } });
          await interaction.reply(`✅ Added knowledge entry: **${question}**`);
        } else if (sub === 'list') {
          const entries = await prisma.knowledgeBase.findMany({ where: { guildId: interaction.guildId! }, take: 20 });
          if (entries.length === 0) {
            await interaction.reply('No knowledge entries yet.');
            return;
          }
          const embed = new EmbedBuilder().setTitle('📚 Knowledge Base').setColor(0x5865f2).setDescription(entries.map((e) => `\`${e.id}\` **${e.question}**`).join('\n'));
          await interaction.reply({ embeds: [embed] });
        } else {
          const id = interaction.options.getString('id', true);
          const deleted = await prisma.knowledgeBase.deleteMany({ where: { id, guildId: interaction.guildId! } });
          await interaction.reply(deleted.count > 0 ? '🗑️ Removed.' : 'Entry not found.');
        }
      }
    }
  ],
  events: {
    messageCreate: async (message) => {
      if (!message.inGuild() || message.author.bot) return;
      const settings = await getGuildSettings(message.guildId);
      if (!settings.aiEnabled) return;

      const mentioned = message.mentions.has(message.client.user!);
      const inConfiguredChannel = settings.aiChatChannelIds.includes(message.channelId);
      if (!mentioned && !inConfiguredChannel) return;

      await respondInChannel(message, settings).catch(() => undefined);
    }
  },
  components: [
    {
      prefix: 'escalation_answer_',
      handleButton: async (interaction) => {
        const escalationId = interaction.customId.replace('escalation_answer_', '');
        const modal = new ModalBuilder()
          .setCustomId(`escalation_answer_modal_${escalationId}`)
          .setTitle('Answer')
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder().setCustomId('answer').setLabel('Your answer').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1500)
            )
          );
        await interaction.showModal(modal);
      },
      handleModal: async (interaction) => {
        if (!interaction.customId.startsWith('escalation_answer_modal_')) return;
        const escalationId = interaction.customId.replace('escalation_answer_modal_', '');
        const escalation = await prisma.aIEscalation.findUnique({ where: { id: escalationId } });
        if (!escalation) {
          await interaction.reply({ content: 'This escalation no longer exists.', ephemeral: true });
          return;
        }
        const answer = interaction.fields.getTextInputValue('answer');
        await prisma.aIEscalation.update({ where: { id: escalation.id }, data: { resolved: true, answeredById: interaction.user.id, answer } });

        const user = await interaction.client.users.fetch(escalation.userId).catch(() => null);
        await user?.send(`💬 A staff member answered your question in **${interaction.guild?.name}**:\n**Q:** ${escalation.question}\n**A:** ${answer}`).catch(() => undefined);

        if (interaction.isFromMessage()) {
          const embed = EmbedBuilder.from(interaction.message.embeds[0]).addFields({ name: 'Answered by', value: `<@${interaction.user.id}>` }).setColor(0x57f287);
          await interaction.update({ embeds: [embed], components: [buildEscalationComponents(escalation.id, true)] });
        } else {
          await interaction.reply({ content: '✅ Answer sent.', ephemeral: true });
        }
      }
    },
    {
      prefix: 'escalation_knowledge_',
      handleButton: async (interaction) => {
        const escalationId = interaction.customId.replace('escalation_knowledge_', '');
        const escalation = await prisma.aIEscalation.findUnique({ where: { id: escalationId } });
        const modal = new ModalBuilder()
          .setCustomId(`escalation_knowledge_modal_${escalationId}`)
          .setTitle('Add to Knowledge')
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder().setCustomId('question').setLabel('Question').setStyle(TextInputStyle.Short).setRequired(true).setValue(escalation?.question.slice(0, 100) ?? '')
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder().setCustomId('answer').setLabel('Answer').setStyle(TextInputStyle.Paragraph).setRequired(true)
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder().setCustomId('category').setLabel('Category').setPlaceholder('general/rules/support/faq').setStyle(TextInputStyle.Short).setRequired(false)
            )
          );
        await interaction.showModal(modal);
      },
      handleModal: async (interaction) => {
        if (!interaction.customId.startsWith('escalation_knowledge_modal_')) return;
        const escalationId = interaction.customId.replace('escalation_knowledge_modal_', '');
        const question = interaction.fields.getTextInputValue('question');
        const answer = interaction.fields.getTextInputValue('answer');
        const category = interaction.fields.getTextInputValue('category') || 'general';

        await prisma.knowledgeBase.create({ data: { guildId: interaction.guildId!, question, answer, category, addedById: interaction.user.id } });
        const escalation = await prisma.aIEscalation.update({ where: { id: escalationId }, data: { resolved: true, answeredById: interaction.user.id, answer } }).catch(() => null);

        if (escalation) {
          const user = await interaction.client.users.fetch(escalation.userId).catch(() => null);
          await user?.send(`💬 A staff member answered your question in **${interaction.guild?.name}**:\n**Q:** ${escalation.question}\n**A:** ${answer}`).catch(() => undefined);
        }

        if (interaction.isFromMessage() && interaction.message.embeds[0]) {
          const embed = EmbedBuilder.from(interaction.message.embeds[0]).addFields({ name: 'Added to Knowledge by', value: `<@${interaction.user.id}>` }).setColor(0x57f287);
          await interaction.update({ embeds: [embed], components: [buildEscalationComponents(escalationId, true)] });
        } else {
          await interaction.reply({ content: '✅ Added to knowledge base.', ephemeral: true });
        }
      }
    }
  ]
};
