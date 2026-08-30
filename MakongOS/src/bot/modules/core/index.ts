import { SlashCommandBuilder, EmbedBuilder, MessageFlags, version as djsVersion } from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { getGuildSettings } from '../../../database/settingsCache';

const startedAt = Date.now();

export const coreModule: FeatureModule = {
  name: 'core',
  description: 'Bot utility commands: help, ping, server info.',
  commands: [
    {
      data: new SlashCommandBuilder().setName('ping').setDescription('Check the bot latency and uptime.'),
      module: 'core',
      execute: async (interaction) => {
        const uptimeSec = Math.floor((Date.now() - startedAt) / 1000);
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('🏓 Pong!')
          .addFields(
            { name: 'Websocket Latency', value: `${interaction.client.ws.ping}ms`, inline: true },
            { name: 'Uptime', value: formatDuration(uptimeSec), inline: true },
            { name: 'discord.js', value: djsVersion, inline: true }
          );
        await interaction.reply({ embeds: [embed] });
      }
    },
    {
      data: new SlashCommandBuilder().setName('help').setDescription('Show what MakongOS can do.'),
      module: 'core',
      execute: async (interaction) => {
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('🤖 MakongOS')
          .setDescription(
            'MakongOS is an AI-first Discord assistant for your Minecraft community, with tickets, economy, ' +
              'suggestions, giveaways and music alongside it. Manage everything from the web dashboard.'
          )
          .addFields(
            { name: '🤖 AI Assistant', value: '`/ai ask` `/ai image` `/ai forget` — just talk to the bot naturally too', inline: false },
            { name: '🎫 Tickets', value: '`/ticket-panel` — open the support center', inline: false },
            { name: '💰 Economy', value: '`/balance` `/daily` `/beg` `/gamble` `/bank` `/rep`', inline: false },
            { name: '🎵 Music', value: '`/play` `/queue` `/skip` `/stop`', inline: false },
            { name: '🎉 Fun', value: '`/coinflip` `/8ball` `/meme` `/hug` `/filter` `/overlay`', inline: false },
            { name: '📣 Suggestions & Giveaways', value: '`/suggest` `/giveaway start`', inline: false },
            { name: '📈 Stats', value: '`/rank` `/leaderboard`', inline: false }
          )
          .setFooter({ text: 'Configure every system in the web dashboard — no code required.' });
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
    },
    {
      data: new SlashCommandBuilder().setName('server').setDescription('Show Discord server information.'),
      module: 'core',
      execute: async (interaction) => {
        if (!interaction.guild) {
          await interaction.reply({ content: 'This command only works in a server.', flags: MessageFlags.Ephemeral });
          return;
        }
        const settings = await getGuildSettings(interaction.guild.id);
        const embed = new EmbedBuilder()
          .setColor(settings.embedColor as `#${string}`)
          .setTitle(interaction.guild.name)
          .setThumbnail(interaction.guild.iconURL())
          .addFields(
            { name: 'Members', value: `${interaction.guild.memberCount}`, inline: true },
            { name: 'Created', value: `<t:${Math.floor(interaction.guild.createdTimestamp / 1000)}:R>`, inline: true },
            { name: 'Boost Level', value: `${interaction.guild.premiumTier}`, inline: true }
          );
        await interaction.reply({ embeds: [embed] });
      }
    }
  ]
};

function formatDuration(totalSeconds: number): string {
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(' ');
}
