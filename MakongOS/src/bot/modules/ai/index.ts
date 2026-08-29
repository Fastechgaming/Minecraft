import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags, Events } from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { getGuildSettings } from '../../../database/settingsCache';
import { geminiProvider } from '../../../providers/ai/geminiProvider';
import { decideAIResponse } from '../../../ai/decisionEngine';
import { handleStaffAssistantMessage } from '../../../ai/staffAssistant';
import { maybeRunAIModeration } from '../../../ai/moderationPipeline';
import { forgetUserMemory, rememberFact } from '../../../ai/memory';
import { searchKnowledge, formatKnowledgeForPrompt } from '../../../ai/knowledge';
import { isWithinLimits, incrementUsage } from '../../../ai/usage';
import { consumeCooldown } from '../../../services/cooldowns';

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
  ]
};
