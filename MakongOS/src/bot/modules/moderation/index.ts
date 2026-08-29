import {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type GuildMember,
  type TextChannel
} from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { getGuildSettings } from '../../../database/settingsCache';
import { isModerator } from '../../../services/permissions';
import { createModerationCase, getModerationHistory, addWarning } from '../../../moderation/service';

async function requireModerator(interaction: ChatInputCommandInteraction): Promise<boolean> {
  const guildId = interaction.guildId;
  if (!guildId) return false;
  const settings = await getGuildSettings(guildId);
  const member = interaction.member as GuildMember;
  if (!isModerator(member, settings)) {
    await interaction.reply({ content: '🚫 You need moderator permissions to use this command.', flags: MessageFlags.Ephemeral });
    return false;
  }
  return true;
}

export const moderationModule: FeatureModule = {
  name: 'moderation',
  description: 'Warnings, timeouts, kicks, bans, purges and channel controls with full case logging.',
  commands: [
    {
      data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a member.')
        .addUserOption((o) => o.setName('user').setDescription('User to warn').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Reason for the warning'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
      module: 'moderation',
      execute: async (interaction) => {
        if (!(await requireModerator(interaction)) || !interaction.guildId) return;
        const user = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') ?? undefined;

        await addWarning(interaction.guildId, user.id, interaction.user.id, reason);
        await createModerationCase(interaction.client, {
          guildId: interaction.guildId,
          targetId: user.id,
          moderatorId: interaction.user.id,
          action: 'warn',
          reason
        });

        await user.send(`⚠️ You were warned in **${interaction.guild!.name}**: ${reason ?? 'No reason provided'}`).catch(() => undefined);
        await interaction.reply({ embeds: [caseEmbed('⚠️ Member Warned', user.tag, reason)] });
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout a member.')
        .addUserOption((o) => o.setName('user').setDescription('User to timeout').setRequired(true))
        .addIntegerOption((o) => o.setName('minutes').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(40320))
        .addStringOption((o) => o.setName('reason').setDescription('Reason'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
      module: 'moderation',
      execute: async (interaction) => {
        if (!(await requireModerator(interaction)) || !interaction.guildId) return;
        const user = interaction.options.getUser('user', true);
        const minutes = interaction.options.getInteger('minutes', true);
        const reason = interaction.options.getString('reason') ?? undefined;

        const member = await interaction.guild!.members.fetch(user.id).catch(() => null);
        if (!member) {
          await interaction.reply({ content: 'That user is not in this server.', flags: MessageFlags.Ephemeral });
          return;
        }
        await member.timeout(minutes * 60_000, reason);
        await createModerationCase(interaction.client, {
          guildId: interaction.guildId,
          targetId: user.id,
          moderatorId: interaction.user.id,
          action: 'timeout',
          reason,
          durationSec: minutes * 60
        });
        await interaction.reply({ embeds: [caseEmbed('⏳ Member Timed Out', user.tag, reason, `${minutes} minutes`)] });
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a member.')
        .addUserOption((o) => o.setName('user').setDescription('User to kick').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Reason'))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
      module: 'moderation',
      execute: async (interaction) => {
        if (!(await requireModerator(interaction)) || !interaction.guildId) return;
        const user = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') ?? undefined;
        const member = await interaction.guild!.members.fetch(user.id).catch(() => null);
        if (!member) {
          await interaction.reply({ content: 'That user is not in this server.', flags: MessageFlags.Ephemeral });
          return;
        }
        await member.kick(reason);
        await createModerationCase(interaction.client, {
          guildId: interaction.guildId,
          targetId: user.id,
          moderatorId: interaction.user.id,
          action: 'kick',
          reason
        });
        await interaction.reply({ embeds: [caseEmbed('👢 Member Kicked', user.tag, reason)] });
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a member.')
        .addUserOption((o) => o.setName('user').setDescription('User to ban').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Reason'))
        .addIntegerOption((o) => o.setName('delete_days').setDescription('Delete message history (days)').setMinValue(0).setMaxValue(7))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
      module: 'moderation',
      execute: async (interaction) => {
        if (!(await requireModerator(interaction)) || !interaction.guildId) return;
        const user = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') ?? undefined;
        const deleteDays = interaction.options.getInteger('delete_days') ?? 0;

        await interaction.guild!.members.ban(user.id, { deleteMessageSeconds: deleteDays * 86400, reason });
        await createModerationCase(interaction.client, {
          guildId: interaction.guildId,
          targetId: user.id,
          moderatorId: interaction.user.id,
          action: 'ban',
          reason
        });
        await interaction.reply({ embeds: [caseEmbed('🔨 Member Banned', user.tag, reason)] });
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user by ID.')
        .addStringOption((o) => o.setName('user_id').setDescription('User ID to unban').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Reason'))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
      module: 'moderation',
      execute: async (interaction) => {
        if (!(await requireModerator(interaction)) || !interaction.guildId) return;
        const userId = interaction.options.getString('user_id', true);
        const reason = interaction.options.getString('reason') ?? undefined;
        await interaction.guild!.members.unban(userId, reason).catch(() => undefined);
        await createModerationCase(interaction.client, {
          guildId: interaction.guildId,
          targetId: userId,
          moderatorId: interaction.user.id,
          action: 'unban',
          reason
        });
        await interaction.reply({ embeds: [caseEmbed('✅ Member Unbanned', userId, reason)] });
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('softban')
        .setDescription('Ban then immediately unban a member to purge their recent messages.')
        .addUserOption((o) => o.setName('user').setDescription('User to softban').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Reason'))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
      module: 'moderation',
      execute: async (interaction) => {
        if (!(await requireModerator(interaction)) || !interaction.guildId) return;
        const user = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') ?? undefined;
        await interaction.guild!.members.ban(user.id, { deleteMessageSeconds: 86400, reason });
        await interaction.guild!.members.unban(user.id, 'Softban cleanup').catch(() => undefined);
        await createModerationCase(interaction.client, {
          guildId: interaction.guildId,
          targetId: user.id,
          moderatorId: interaction.user.id,
          action: 'softban',
          reason
        });
        await interaction.reply({ embeds: [caseEmbed('🧹 Member Softbanned', user.tag, reason)] });
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Bulk delete recent messages.')
        .addIntegerOption((o) => o.setName('count').setDescription('Number of messages (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
        .addUserOption((o) => o.setName('user').setDescription('Only delete messages from this user'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
      module: 'moderation',
      execute: async (interaction) => {
        if (!(await requireModerator(interaction)) || !interaction.guildId) return;
        const count = interaction.options.getInteger('count', true);
        const user = interaction.options.getUser('user');
        const channel = interaction.channel as TextChannel;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const messages = await channel.messages.fetch({ limit: count });
        const filtered = user ? messages.filter((m) => m.author.id === user.id) : messages;
        const deleted = await channel.bulkDelete(filtered, true).catch(() => null);

        await createModerationCase(interaction.client, {
          guildId: interaction.guildId,
          targetId: user?.id ?? 'bulk',
          moderatorId: interaction.user.id,
          action: 'purge',
          metadata: { channelId: channel.id, deleted: deleted?.size ?? 0 }
        });
        await interaction.editReply(`🧹 Deleted ${deleted?.size ?? 0} messages.`);
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Set slowmode for the current channel.')
        .addIntegerOption((o) => o.setName('seconds').setDescription('Seconds between messages (0 to disable)').setRequired(true).setMinValue(0).setMaxValue(21600))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
      module: 'moderation',
      execute: async (interaction) => {
        if (!(await requireModerator(interaction)) || !interaction.guildId) return;
        const seconds = interaction.options.getInteger('seconds', true);
        const channel = interaction.channel as TextChannel;
        await channel.setRateLimitPerUser(seconds);
        await createModerationCase(interaction.client, {
          guildId: interaction.guildId,
          targetId: 'channel',
          moderatorId: interaction.user.id,
          action: 'slowmode',
          durationSec: seconds,
          metadata: { channelId: channel.id }
        });
        await interaction.reply(seconds === 0 ? '🐇 Slowmode disabled.' : `🐢 Slowmode set to ${seconds}s.`);
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('lock')
        .setDescription('Lock the current channel for @everyone.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
      module: 'moderation',
      execute: async (interaction) => {
        if (!(await requireModerator(interaction)) || !interaction.guildId) return;
        const channel = interaction.channel as TextChannel;
        await channel.permissionOverwrites.edit(interaction.guild!.roles.everyone, { SendMessages: false });
        await createModerationCase(interaction.client, {
          guildId: interaction.guildId,
          targetId: 'channel',
          moderatorId: interaction.user.id,
          action: 'lock',
          metadata: { channelId: channel.id }
        });
        await interaction.reply('🔒 Channel locked.');
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Unlock the current channel for @everyone.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
      module: 'moderation',
      execute: async (interaction) => {
        if (!(await requireModerator(interaction)) || !interaction.guildId) return;
        const channel = interaction.channel as TextChannel;
        await channel.permissionOverwrites.edit(interaction.guild!.roles.everyone, { SendMessages: null });
        await createModerationCase(interaction.client, {
          guildId: interaction.guildId,
          targetId: 'channel',
          moderatorId: interaction.user.id,
          action: 'unlock',
          metadata: { channelId: channel.id }
        });
        await interaction.reply('🔓 Channel unlocked.');
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('cases')
        .setDescription("View a member's moderation history.")
        .addUserOption((o) => o.setName('user').setDescription('User to look up').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
      module: 'moderation',
      execute: async (interaction) => {
        if (!(await requireModerator(interaction)) || !interaction.guildId) return;
        const user = interaction.options.getUser('user', true);
        const cases = await getModerationHistory(interaction.guildId, user.id, 10);
        if (cases.length === 0) {
          await interaction.reply({ content: `${user.tag} has a clean record.`, flags: MessageFlags.Ephemeral });
          return;
        }
        const embed = new EmbedBuilder()
          .setColor(0xda373c)
          .setTitle(`Moderation History — ${user.tag}`)
          .setDescription(
            cases
              .map((c) => `**#${c.id}** \`${c.action}\` — ${c.reason ?? 'No reason'} (<t:${Math.floor(c.createdAt.getTime() / 1000)}:R>)`)
              .join('\n')
          );
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('nickname')
        .setDescription("Change a member's nickname.")
        .addUserOption((o) => o.setName('user').setDescription('User to rename').setRequired(true))
        .addStringOption((o) => o.setName('nickname').setDescription('New nickname (leave empty to reset)'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),
      module: 'moderation',
      execute: async (interaction) => {
        if (!(await requireModerator(interaction)) || !interaction.guildId) return;
        const user = interaction.options.getUser('user', true);
        const nickname = interaction.options.getString('nickname');
        const member = await interaction.guild!.members.fetch(user.id).catch(() => null);
        if (!member) {
          await interaction.reply({ content: 'That user is not in this server.', flags: MessageFlags.Ephemeral });
          return;
        }
        await member.setNickname(nickname);
        await createModerationCase(interaction.client, {
          guildId: interaction.guildId,
          targetId: user.id,
          moderatorId: interaction.user.id,
          action: 'nickname',
          metadata: { nickname }
        });
        await interaction.reply(`✏️ Updated nickname for ${user.tag}.`);
      }
    }
  ]
};

function caseEmbed(title: string, target: string, reason?: string, duration?: string) {
  return new EmbedBuilder()
    .setColor(0xda373c)
    .setTitle(title)
    .addFields(
      { name: 'User', value: target, inline: true },
      ...(duration ? [{ name: 'Duration', value: duration, inline: true }] : []),
      { name: 'Reason', value: reason ?? 'No reason provided', inline: false }
    )
    .setTimestamp(new Date());
}
