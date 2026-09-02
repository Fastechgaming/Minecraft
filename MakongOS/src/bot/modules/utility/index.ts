import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { prisma } from '../../../database/prisma';
import { getGuildSettings } from '../../../database/settingsCache';
import { isAdmin } from '../../../services/permissions';
import { createBackup, listBackups, restoreBackup } from '../../../utility/backup';
import { pollAllAlerts } from '../../../social/alerts';

function formatUptime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(' ') || '<1m';
}

function interpolate(template: string, user: string, server: string): string {
  return template.replaceAll('{user}', user).replaceAll('{server}', server);
}

export const utilityModule: FeatureModule = {
  name: 'utility',
  description: 'Server info, welcome/leave messages, social alerts, and server backups.',
  commands: [
    {
      data: new SlashCommandBuilder().setName('userinfo').setDescription('Show info about a member').addUserOption((o) => o.setName('user').setDescription('Member').setRequired(false)),
      userInstallable: true,
      execute: async (interaction) => {
        const target = interaction.options.getUser('user') ?? interaction.user;
        const member = interaction.inGuild() ? await interaction.guild!.members.fetch(target.id).catch(() => null) : null;
        const embed = new EmbedBuilder()
          .setTitle(target.tag)
          .setThumbnail(target.displayAvatarURL({ size: 256 }))
          .setColor(0x5865f2)
          .addFields(
            { name: 'ID', value: target.id, inline: true },
            { name: 'Account Created', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`, inline: true },
            ...(member ? [{ name: 'Joined Server', value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Unknown', inline: true }] : [])
          );
        await interaction.reply({ embeds: [embed] });
      }
    },
    {
      data: new SlashCommandBuilder().setName('avatar').setDescription("Show a member's avatar").addUserOption((o) => o.setName('user').setDescription('Member').setRequired(false)),
      userInstallable: true,
      execute: async (interaction) => {
        const target = interaction.options.getUser('user') ?? interaction.user;
        const embed = new EmbedBuilder().setTitle(`${target.username}'s Avatar`).setImage(target.displayAvatarURL({ size: 1024 })).setColor(0x5865f2);
        await interaction.reply({ embeds: [embed] });
      }
    },
    {
      data: new SlashCommandBuilder().setName('serverinfo').setDescription('Show info about this server'),
      execute: async (interaction) => {
        const guild = interaction.guild!;
        const embed = new EmbedBuilder()
          .setTitle(guild.name)
          .setThumbnail(guild.iconURL({ size: 256 }))
          .setColor(0x5865f2)
          .addFields(
            { name: 'Members', value: guild.memberCount.toString(), inline: true },
            { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
            { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
            { name: 'Roles', value: guild.roles.cache.size.toString(), inline: true },
            { name: 'Channels', value: guild.channels.cache.size.toString(), inline: true },
            { name: 'Boosts', value: (guild.premiumSubscriptionCount ?? 0).toString(), inline: true }
          );
        await interaction.reply({ embeds: [embed] });
      }
    },
    {
      data: new SlashCommandBuilder().setName('bot').setDescription('Show bot stats'),
      userInstallable: true,
      execute: async (interaction) => {
        const client = interaction.client;
        const embed = new EmbedBuilder()
          .setTitle('MakongOS')
          .setColor(0x5865f2)
          .addFields(
            { name: 'Servers', value: client.guilds.cache.size.toString(), inline: true },
            { name: 'Uptime', value: formatUptime(client.uptime ?? 0), inline: true },
            { name: 'Ping', value: `${Math.round(client.ws.ping)}ms`, inline: true },
            { name: 'Memory', value: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(0)}MB`, inline: true }
          );
        await interaction.reply({ embeds: [embed] });
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('backup')
        .setDescription('Backup and restore server structure')
        .addSubcommand((s) => s.setName('create').setDescription('Create a backup').addStringOption((o) => o.setName('name').setDescription('Backup name').setRequired(true)))
        .addSubcommand((s) => s.setName('list').setDescription('List backups'))
        .addSubcommand((s) => s.setName('restore').setDescription('Restore missing roles/channels from a backup').addStringOption((o) => o.setName('id').setDescription('Backup ID').setRequired(true))),
      execute: async (interaction) => {
        const settings = await getGuildSettings(interaction.guildId!);
        const member = interaction.member;
        if (!member || !('roles' in member) || !isAdmin(member as never, settings)) {
          await interaction.reply({ content: 'You need to be an administrator to manage backups.', ephemeral: true });
          return;
        }
        const sub = interaction.options.getSubcommand();

        if (sub === 'create') {
          const name = interaction.options.getString('name', true);
          const backup = await createBackup(interaction.guild!, name, interaction.user.id);
          await interaction.reply(`✅ Backup **${name}** created. ID: \`${backup.id}\``);
        } else if (sub === 'list') {
          const backups = await listBackups(interaction.guildId!);
          if (backups.length === 0) {
            await interaction.reply('No backups yet.');
            return;
          }
          await interaction.reply(backups.map((b) => `\`${b.id}\` **${b.name}** — <t:${Math.floor(b.createdAt.getTime() / 1000)}:R>`).join('\n'));
        } else {
          const id = interaction.options.getString('id', true);
          await interaction.deferReply();
          try {
            const result = await restoreBackup(interaction.guild!, id);
            await interaction.editReply(`✅ Restore complete: ${result.rolesCreated} role(s) and ${result.channelsCreated} channel(s) recreated (existing structure was left untouched).`);
          } catch {
            await interaction.editReply('❌ Backup not found.');
          }
        }
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('socialalert')
        .setDescription('Manage Twitch/YouTube live & upload alerts')
        .addSubcommand((s) =>
          s
            .setName('add')
            .setDescription('Add a social alert')
            .addStringOption((o) => o.setName('platform').setDescription('Platform').setRequired(true).addChoices({ name: 'Twitch', value: 'twitch' }, { name: 'YouTube', value: 'youtube' }))
            .addStringOption((o) => o.setName('handle').setDescription('Twitch login or YouTube channel ID').setRequired(true))
            .addChannelOption((o) => o.setName('channel').setDescription('Channel to announce in').setRequired(true))
            .addStringOption((o) => o.setName('message').setDescription('Custom message ({creator}, {url})').setRequired(false))
        )
        .addSubcommand((s) =>
          s
            .setName('remove')
            .setDescription('Remove a social alert')
            .addStringOption((o) => o.setName('platform').setDescription('Platform').setRequired(true).addChoices({ name: 'Twitch', value: 'twitch' }, { name: 'YouTube', value: 'youtube' }))
            .addStringOption((o) => o.setName('handle').setDescription('Twitch login or YouTube channel ID').setRequired(true))
        )
        .addSubcommand((s) => s.setName('list').setDescription('List social alerts')),
      execute: async (interaction) => {
        const settings = await getGuildSettings(interaction.guildId!);
        const member = interaction.member;
        if (!member || !('roles' in member) || !isAdmin(member as never, settings)) {
          await interaction.reply({ content: 'You need to be an administrator to manage social alerts.', ephemeral: true });
          return;
        }
        const sub = interaction.options.getSubcommand();

        if (sub === 'add') {
          const platform = interaction.options.getString('platform', true);
          const handle = interaction.options.getString('handle', true);
          const channel = interaction.options.getChannel('channel', true);
          const message = interaction.options.getString('message') ?? '{creator} is now live! {url}';
          await prisma.socialAlert.upsert({
            where: { guildId_platform_channelHandle: { guildId: interaction.guildId!, platform, channelHandle: handle } },
            update: { announceChannelId: channel.id, message },
            create: { guildId: interaction.guildId!, platform, channelHandle: handle, announceChannelId: channel.id, message }
          });
          await interaction.reply(`✅ Added ${platform} alert for **${handle}**.`);
        } else if (sub === 'remove') {
          const platform = interaction.options.getString('platform', true);
          const handle = interaction.options.getString('handle', true);
          await prisma.socialAlert.deleteMany({ where: { guildId: interaction.guildId!, platform, channelHandle: handle } });
          await interaction.reply(`🗑️ Removed ${platform} alert for **${handle}**.`);
        } else {
          const alerts = await prisma.socialAlert.findMany({ where: { guildId: interaction.guildId! } });
          if (alerts.length === 0) {
            await interaction.reply('No social alerts configured.');
            return;
          }
          await interaction.reply(alerts.map((a) => `**${a.platform}**: ${a.channelHandle} → <#${a.announceChannelId}>`).join('\n'));
        }
      }
    }
  ],
  events: {
    guildMemberAdd: async (member) => {
      const settings = await getGuildSettings(member.guild.id);
      if (settings.welcomeEnabled && settings.welcomeChannelId) {
        const channel = await member.guild.channels.fetch(settings.welcomeChannelId).catch(() => null);
        if (channel?.isTextBased()) {
          await channel.send(interpolate(settings.welcomeMessage, `${member}`, member.guild.name)).catch(() => undefined);
        }
      }
      for (const roleId of settings.autoRoleIds) {
        await member.roles.add(roleId).catch(() => undefined);
      }
    },
    guildMemberRemove: async (member) => {
      const settings = await getGuildSettings(member.guild.id);
      if (settings.leaveEnabled && settings.leaveChannelId) {
        const channel = await member.guild.channels.fetch(settings.leaveChannelId).catch(() => null);
        const tag = 'user' in member ? member.user.tag : 'A member';
        if (channel?.isTextBased()) {
          await channel.send(interpolate(settings.leaveMessage, tag, member.guild.name)).catch(() => undefined);
        }
      }
    }
  },
  onReady: (client) => {
    setInterval(() => pollAllAlerts(client).catch(() => undefined), 5 * 60_000);
  }
};
