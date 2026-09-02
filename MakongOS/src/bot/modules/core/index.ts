import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { modules } from '../../registry';

export const coreModule: FeatureModule = {
  name: 'core',
  description: 'Ping, help, and bot info.',
  commands: [
    {
      data: new SlashCommandBuilder().setName('ping').setDescription("Check the bot's latency"),
      execute: async (interaction) => {
        const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        await interaction.editReply(`🏓 Pong! Latency: ${latency}ms | API: ${Math.round(interaction.client.ws.ping)}ms`);
      }
    },
    {
      data: new SlashCommandBuilder().setName('help').setDescription('List MakongOS feature modules'),
      execute: async (interaction) => {
        const embed = new EmbedBuilder()
          .setTitle('MakongOS')
          .setColor(0x5865f2)
          .setDescription(modules.map((m) => `**${m.name}** — ${m.description}`).join('\n'));
        await interaction.reply({ embeds: [embed] });
      }
    }
  ]
};
