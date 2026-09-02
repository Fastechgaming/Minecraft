import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction
} from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { prisma } from '../../../database/prisma';
import { getGuildSettings } from '../../../database/settingsCache';
import { isStaff } from '../../../services/permissions';
import { createCase } from '../../../moderation/cases';
import { runAutomod, trackMessageForGhostPing, checkGhostPing } from '../../../moderation/automod';
import { analyzeImageForScam } from '../../../ai/gemini';
import { logAudit } from '../../../services/auditLog';

function parseDurationMinutes(input: string): number | null {
  const match = /^(\d+)\s*(m|min|h|hr|hour|d|day)s?$/i.exec(input.trim());
  if (!match) return Number.isFinite(Number(input)) ? Number(input) : null;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit.startsWith('m')) return value;
  if (unit.startsWith('h')) return value * 60;
  return value * 60 * 24;
}

async function requireStaff(interaction: ChatInputCommandInteraction): Promise<boolean> {
  const settings = await getGuildSettings(interaction.guildId!);
  const member = interaction.member;
  if (!member || !('roles' in member) || !isStaff(member as never, settings)) {
    await interaction.reply({ content: 'You need a staff role to use this command.', ephemeral: true });
    return false;
  }
  return true;
}

export const moderationModule: FeatureModule = {
  name: 'moderation',
  description: 'Automod, AI anti-scam scanning, case management, and temp roles.',
  commands: [
    {
      data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a member')
        .addUserOption((o) => o.setName('user').setDescription('Member to warn').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false)),
      execute: async (interaction) => {
        if (!(await requireStaff(interaction))) return;
        const target = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') ?? undefined;
        const settings = await getGuildSettings(interaction.guildId!);

        await prisma.warning.create({
          data: {
            guildId: interaction.guildId!,
            userId: target.id,
            reason,
            expiresAt: new Date(Date.now() + settings.warningDecayDays * 86_400_000)
          }
        });
        const c = await createCase(interaction.guildId!, 'warn', { id: target.id, tag: target.tag }, { id: interaction.user.id, tag: interaction.user.tag }, reason);
        await target.send(`You were warned in **${interaction.guild!.name}**${reason ? `: ${reason}` : '.'}`).catch(() => undefined);
        await interaction.reply(`⚠️ Case #${c.caseNumber} — warned ${target.tag}${reason ? ` for: ${reason}` : ''}.`);
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout a member')
        .addUserOption((o) => o.setName('user').setDescription('Member to timeout').setRequired(true))
        .addStringOption((o) => o.setName('duration').setDescription('e.g. 10m, 1h, 1d').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false)),
      execute: async (interaction) => {
        if (!(await requireStaff(interaction))) return;
        const targetUser = interaction.options.getUser('user', true);
        const minutes = parseDurationMinutes(interaction.options.getString('duration', true));
        const reason = interaction.options.getString('reason') ?? undefined;
        if (!minutes || minutes <= 0 || minutes > 40320) {
          await interaction.reply({ content: 'Invalid duration (max 28 days).', ephemeral: true });
          return;
        }
        const member = await interaction.guild!.members.fetch(targetUser.id).catch(() => null);
        if (!member) {
          await interaction.reply({ content: 'Member not found in this server.', ephemeral: true });
          return;
        }
        if (!member.moderatable) {
          await interaction.reply({ content: "I can't timeout that member (role hierarchy).", ephemeral: true });
          return;
        }
        await member.timeout(minutes * 60_000, reason);
        const c = await createCase(interaction.guildId!, 'timeout', { id: targetUser.id, tag: targetUser.tag }, { id: interaction.user.id, tag: interaction.user.tag }, reason);
        await interaction.reply(`⏱️ Case #${c.caseNumber} — timed out ${targetUser.tag} for ${interaction.options.getString('duration', true)}${reason ? `: ${reason}` : ''}.`);
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('untimeout')
        .setDescription('Remove a timeout')
        .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false)),
      execute: async (interaction) => {
        if (!(await requireStaff(interaction))) return;
        const targetUser = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') ?? undefined;
        const member = await interaction.guild!.members.fetch(targetUser.id).catch(() => null);
        if (!member) {
          await interaction.reply({ content: 'Member not found.', ephemeral: true });
          return;
        }
        await member.timeout(null, reason);
        const c = await createCase(interaction.guildId!, 'untimeout', { id: targetUser.id, tag: targetUser.tag }, { id: interaction.user.id, tag: interaction.user.tag }, reason);
        await interaction.reply(`✅ Case #${c.caseNumber} — removed timeout from ${targetUser.tag}.`);
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a member')
        .addUserOption((o) => o.setName('user').setDescription('Member to kick').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false)),
      execute: async (interaction) => {
        if (!(await requireStaff(interaction))) return;
        const targetUser = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') ?? undefined;
        const member = await interaction.guild!.members.fetch(targetUser.id).catch(() => null);
        if (!member?.kickable) {
          await interaction.reply({ content: "I can't kick that member.", ephemeral: true });
          return;
        }
        await member.send(`You were kicked from **${interaction.guild!.name}**${reason ? `: ${reason}` : '.'}`).catch(() => undefined);
        await member.kick(reason);
        const c = await createCase(interaction.guildId!, 'kick', { id: targetUser.id, tag: targetUser.tag }, { id: interaction.user.id, tag: interaction.user.tag }, reason);
        await interaction.reply(`👢 Case #${c.caseNumber} — kicked ${targetUser.tag}${reason ? `: ${reason}` : ''}.`);
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a member')
        .addUserOption((o) => o.setName('user').setDescription('Member to ban').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false))
        .addIntegerOption((o) => o.setName('delete_days').setDescription('Delete recent messages (0-7 days)').setMinValue(0).setMaxValue(7)),
      execute: async (interaction) => {
        if (!(await requireStaff(interaction))) return;
        const targetUser = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') ?? undefined;
        const deleteDays = interaction.options.getInteger('delete_days') ?? 0;
        const member = await interaction.guild!.members.fetch(targetUser.id).catch(() => null);
        if (member && !member.bannable) {
          await interaction.reply({ content: "I can't ban that member.", ephemeral: true });
          return;
        }
        await member?.send(`You were banned from **${interaction.guild!.name}**${reason ? `: ${reason}` : '.'}`).catch(() => undefined);
        await interaction.guild!.members.ban(targetUser.id, { reason, deleteMessageSeconds: deleteDays * 86400 });
        const c = await createCase(interaction.guildId!, 'ban', { id: targetUser.id, tag: targetUser.tag }, { id: interaction.user.id, tag: interaction.user.tag }, reason);
        await interaction.reply(`🔨 Case #${c.caseNumber} — banned ${targetUser.tag}${reason ? `: ${reason}` : ''}.`);
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user by ID')
        .addStringOption((o) => o.setName('user_id').setDescription('User ID').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false)),
      execute: async (interaction) => {
        if (!(await requireStaff(interaction))) return;
        const userId = interaction.options.getString('user_id', true);
        const reason = interaction.options.getString('reason') ?? undefined;
        const banned = await interaction.guild!.bans.fetch(userId).catch(() => null);
        if (!banned) {
          await interaction.reply({ content: 'That user is not banned.', ephemeral: true });
          return;
        }
        await interaction.guild!.members.unban(userId, reason);
        const c = await createCase(interaction.guildId!, 'unban', { id: userId, tag: banned.user.tag }, { id: interaction.user.id, tag: interaction.user.tag }, reason);
        await interaction.reply(`✅ Case #${c.caseNumber} — unbanned ${banned.user.tag}.`);
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('case')
        .setDescription('Manage moderation cases')
        .addSubcommand((s) => s.setName('view').setDescription('View a case').addIntegerOption((o) => o.setName('id').setDescription('Case number').setRequired(true)))
        .addSubcommand((s) => s.setName('history').setDescription('View a user\'s case history').addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)))
        .addSubcommand((s) => s.setName('delete').setDescription('Delete a case').addIntegerOption((o) => o.setName('id').setDescription('Case number').setRequired(true))),
      execute: async (interaction) => {
        if (!(await requireStaff(interaction))) return;
        const sub = interaction.options.getSubcommand();

        if (sub === 'view') {
          const id = interaction.options.getInteger('id', true);
          const c = await prisma.moderationCase.findUnique({ where: { guildId_caseNumber: { guildId: interaction.guildId!, caseNumber: id } } });
          if (!c) {
            await interaction.reply({ content: `Case #${id} not found.`, ephemeral: true });
            return;
          }
          const embed = new EmbedBuilder()
            .setTitle(`Case #${c.caseNumber} — ${c.type}`)
            .setColor(c.active ? 0xed4245 : 0x99aab5)
            .addFields(
              { name: 'Target', value: c.targetTag, inline: true },
              { name: 'Moderator', value: c.moderatorTag, inline: true },
              { name: 'Reason', value: c.reason ?? 'No reason given' }
            )
            .setTimestamp(c.createdAt);
          await interaction.reply({ embeds: [embed] });
          return;
        }

        if (sub === 'history') {
          const user = interaction.options.getUser('user', true);
          const cases = await prisma.moderationCase.findMany({ where: { guildId: interaction.guildId!, targetId: user.id }, orderBy: { caseNumber: 'desc' }, take: 15 });
          if (cases.length === 0) {
            await interaction.reply({ content: `${user.tag} has no moderation history.`, ephemeral: true });
            return;
          }
          const embed = new EmbedBuilder()
            .setTitle(`Case history — ${user.tag}`)
            .setColor(0x5865f2)
            .setDescription(cases.map((c) => `**#${c.caseNumber}** \`${c.type}\` — ${c.reason ?? 'No reason'}`).join('\n'));
          await interaction.reply({ embeds: [embed] });
          return;
        }

        if (sub === 'delete') {
          const id = interaction.options.getInteger('id', true);
          const deleted = await prisma.moderationCase.deleteMany({ where: { guildId: interaction.guildId!, caseNumber: id } });
          await interaction.reply(deleted.count > 0 ? `🗑️ Deleted case #${id}.` : `Case #${id} not found.`);
        }
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('temprole')
        .setDescription('Manage temporary roles')
        .addSubcommand((s) =>
          s
            .setName('give')
            .setDescription('Give a member a temporary role')
            .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
            .addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true))
            .addStringOption((o) => o.setName('duration').setDescription('e.g. 30m, 2h, 3d').setRequired(true))
        )
        .addSubcommand((s) =>
          s
            .setName('remove')
            .setDescription('Remove a temporary role early')
            .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
            .addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true))
        ),
      execute: async (interaction) => {
        if (!(await requireStaff(interaction))) return;
        const sub = interaction.options.getSubcommand();
        const user = interaction.options.getUser('user', true);
        const role = interaction.options.getRole('role', true);
        const member = await interaction.guild!.members.fetch(user.id).catch(() => null);
        if (!member) {
          await interaction.reply({ content: 'Member not found.', ephemeral: true });
          return;
        }

        if (sub === 'give') {
          const minutes = parseDurationMinutes(interaction.options.getString('duration', true));
          if (!minutes || minutes <= 0) {
            await interaction.reply({ content: 'Invalid duration.', ephemeral: true });
            return;
          }
          await member.roles.add(role.id).catch(() => undefined);
          const expiresAt = new Date(Date.now() + minutes * 60_000);
          await prisma.tempRole.create({ data: { guildId: interaction.guildId!, userId: user.id, roleId: role.id, expiresAt } });
          await member.send(`You were given the **${role.name}** role in **${interaction.guild!.name}** until ${expiresAt.toLocaleString()}.`).catch(() => undefined);
          await interaction.reply(`✅ Gave ${user.tag} **${role.name}** until <t:${Math.floor(expiresAt.getTime() / 1000)}:f>.`);
        } else {
          await member.roles.remove(role.id).catch(() => undefined);
          await prisma.tempRole.deleteMany({ where: { guildId: interaction.guildId!, userId: user.id, roleId: role.id } });
          await interaction.reply(`✅ Removed **${role.name}** from ${user.tag}.`);
        }
      }
    }
  ],
  events: {
    messageCreate: async (message) => {
      if (!message.inGuild() || message.author.bot) return;
      trackMessageForGhostPing(message);
      const settings = await getGuildSettings(message.guildId);

      const automod = await runAutomod(message, settings);
      if (automod.triggered) {
        await message.channel.send({ content: `${message.author}, ${automod.reason?.toLowerCase()}.` }).then((m) => setTimeout(() => m.delete().catch(() => undefined), 5000));
      }

      if (settings.antiScamEnabled && message.attachments.size > 0) {
        const member = message.member;
        const whitelisted =
          member &&
          (isStaff(member, settings) ||
            settings.antiScamWhitelistChannelIds.includes(message.channelId) ||
            settings.antiScamWhitelistRoleIds.some((r) => member.roles.cache.has(r)));
        if (!whitelisted) {
          for (const attachment of message.attachments.values()) {
            if (!attachment.contentType?.startsWith('image/')) continue;
            const scan = await analyzeImageForScam(attachment.url);
            if (scan.isScam && scan.confidence >= 0.7) {
              await message.delete().catch(() => undefined);
              const targetMember = message.member;
              if (targetMember?.moderatable) {
                if (settings.antiScamAction === 'ban' && targetMember.bannable) await targetMember.ban({ reason: `AI anti-scam: ${scan.reason}` });
                else if (settings.antiScamAction === 'kick' && targetMember.kickable) await targetMember.kick(`AI anti-scam: ${scan.reason}`);
                else await targetMember.timeout(settings.antiScamTimeoutMin * 60_000, `AI anti-scam: ${scan.reason}`);
              }
              await createCase(
                message.guildId,
                'antiscam',
                { id: message.author.id, tag: message.author.tag },
                { id: message.client.user!.id, tag: 'MakongOS AI' },
                `${scan.reason} (confidence ${(scan.confidence * 100).toFixed(0)}%)`
              );
              break;
            }
          }
        }
      }
    },
    messageDelete: async (message) => {
      if (!message.guildId) return;
      const ghost = checkGhostPing(message.id);
      if (!ghost) return;
      const settings = await getGuildSettings(message.guildId);
      if (!settings.automodBlockGhostPing) return;
      await logAudit(
        message.guildId,
        'moderation',
        `Ghost ping detected from <@${ghost.authorId}> mentioning ${ghost.mentionedIds.map((id) => `<@${id}>`).join(', ')}`,
        ghost.authorId
      );
    }
  },
  onReady: (client) => {
    setInterval(async () => {
      const due = await prisma.tempRole.findMany({ where: { expiresAt: { lte: new Date() } } });
      for (const temp of due) {
        try {
          const guild = await client.guilds.fetch(temp.guildId);
          const member = await guild.members.fetch(temp.userId).catch(() => null);
          await member?.roles.remove(temp.roleId).catch(() => undefined);
        } finally {
          await prisma.tempRole.delete({ where: { id: temp.id } }).catch(() => undefined);
        }
      }
    }, 60_000);
  }
};
