import { SlashCommandBuilder, EmbedBuilder, MessageFlags, version as djsVersion } from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { prisma } from '../../../database/prisma';
import { getGuildSettings } from '../../../database/settingsCache';

const startedAt = Date.now();

export const coreModule: FeatureModule = {
  name: 'core',
  description: 'Bot utility commands: help, ping, profile, server info.',
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
          .setTitle('🤖 MakongOS — Staff System')
          .setDescription(
            'MakongOS is a full Discord staff system: moderation, tickets, AI assistance, music, ' +
              'games, leveling and more. Manage everything from the web dashboard.'
          )
          .addFields(
            { name: '🛡️ Moderation', value: '`/warn` `/timeout` `/kick` `/ban` `/purge` `/lock`', inline: false },
            { name: '🎫 Tickets', value: '`/ticket panel` — open the support center', inline: false },
            { name: '🎵 Music', value: '`/play` `/queue` `/skip` `/stop`', inline: false },
            { name: '🤖 AI', value: '`/ai ask` `/ai image`', inline: false },
            { name: '🎮 Games & Fun', value: '`/game` `/ship` `/8ball` `/roast`', inline: false },
            { name: '📈 Community', value: '`/level` `/daily` `/leaderboard`', inline: false },
            { name: '⛏️ Minecraft', value: '`/server` `/player`', inline: false }
          )
          .setFooter({ text: 'Configure every system in the web dashboard — no code required.' });
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
    },
    {
      data: new SlashCommandBuilder().setName('profile').setDescription("View a member's profile.").addUserOption((o) =>
        o.setName('user').setDescription('User to view').setRequired(false)
      ),
      module: 'core',
      execute: async (interaction) => {
        const target = interaction.options.getUser('user') ?? interaction.user;
        if (!interaction.guildId) {
          await interaction.reply({ content: 'This command only works in a server.', flags: MessageFlags.Ephemeral });
          return;
        }
        const [xp, warnings, member] = await Promise.all([
          prisma.xP.findUnique({ where: { guildId_userId: { guildId: interaction.guildId, userId: target.id } } }),
          prisma.warning.count({ where: { guildId: interaction.guildId, userId: target.id, active: true } }),
          prisma.member.findUnique({ where: { guildId_userId: { guildId: interaction.guildId, userId: target.id } } })
        ]);

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setAuthor({ name: target.username, iconURL: target.displayAvatarURL() })
          .setThumbnail(target.displayAvatarURL())
          .addFields(
            { name: 'Level', value: `${xp?.level ?? 0}`, inline: true },
            { name: 'XP', value: `${xp?.xp ?? 0}`, inline: true },
            { name: 'Active Warnings', value: `${warnings}`, inline: true },
            { name: 'Minecraft Username', value: member?.minecraftUsername ?? 'Not linked', inline: true }
          );
        await interaction.reply({ embeds: [embed] });
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
