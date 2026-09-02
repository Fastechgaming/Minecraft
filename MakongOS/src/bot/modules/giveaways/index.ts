import { SlashCommandBuilder, EmbedBuilder, type TextChannel } from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { prisma } from '../../../database/prisma';
import { getGuildSettings } from '../../../database/settingsCache';
import { isStaff } from '../../../services/permissions';
import { parseDuration, createGiveaway, endGiveaway, rerollGiveaway, sweepDueGiveaways } from '../../../giveaways/service';

export const giveawaysModule: FeatureModule = {
  name: 'giveaways',
  description: 'Button-based giveaways with role requirements, scheduled auto-end, and rerolls.',
  commands: [
    {
      data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Manage giveaways')
        .addSubcommand((s) =>
          s
            .setName('start')
            .setDescription('Start a giveaway')
            .addStringOption((o) => o.setName('prize').setDescription('What are you giving away?').setRequired(true))
            .addStringOption((o) => o.setName('duration').setDescription('e.g. 10m, 1h, 3d').setRequired(true))
            .addIntegerOption((o) => o.setName('winners').setDescription('Number of winners').setRequired(false).setMinValue(1).setMaxValue(20))
            .addRoleOption((o) => o.setName('required_role').setDescription('Role required to enter').setRequired(false))
        )
        .addSubcommand((s) => s.setName('end').setDescription('End a giveaway early').addStringOption((o) => o.setName('message_id').setDescription('Giveaway message ID').setRequired(true)))
        .addSubcommand((s) => s.setName('reroll').setDescription('Reroll winners').addStringOption((o) => o.setName('message_id').setDescription('Giveaway message ID').setRequired(true)))
        .addSubcommand((s) => s.setName('list').setDescription('List active giveaways')),
      execute: async (interaction) => {
        const settings = await getGuildSettings(interaction.guildId!);
        if (!settings.giveawaysEnabled) {
          await interaction.reply({ content: 'Giveaways are disabled on this server.', ephemeral: true });
          return;
        }
        const sub = interaction.options.getSubcommand();

        if (sub === 'list') {
          const active = await prisma.giveaway.findMany({ where: { guildId: interaction.guildId!, ended: false }, orderBy: { endsAt: 'asc' } });
          if (active.length === 0) {
            await interaction.reply('No active giveaways.');
            return;
          }
          const embed = new EmbedBuilder()
            .setTitle('🎉 Active Giveaways')
            .setColor(0xf1c40f)
            .setDescription(active.map((g) => `**${g.prize}** — ends <t:${Math.floor(g.endsAt.getTime() / 1000)}:R> (\`${g.messageId}\`)`).join('\n'));
          await interaction.reply({ embeds: [embed] });
          return;
        }

        const member = interaction.member;
        if (!member || !('roles' in member) || !isStaff(member as never, settings)) {
          await interaction.reply({ content: 'You need a staff role to manage giveaways.', ephemeral: true });
          return;
        }

        if (sub === 'start') {
          const prize = interaction.options.getString('prize', true);
          const durationMs = parseDuration(interaction.options.getString('duration', true));
          if (!durationMs) {
            await interaction.reply({ content: 'Invalid duration. Try `10m`, `2h`, `3d`.', ephemeral: true });
            return;
          }
          const winners = interaction.options.getInteger('winners') ?? 1;
          const requiredRole = interaction.options.getRole('required_role');
          const giveaway = await createGiveaway(interaction.channel as TextChannel, interaction.user.id, prize, durationMs, winners, requiredRole?.id ?? null);
          await interaction.reply({ content: `✅ Giveaway started: **${prize}** (\`${giveaway.messageId}\`)`, ephemeral: true });
        } else if (sub === 'end') {
          const messageId = interaction.options.getString('message_id', true);
          const giveaway = await prisma.giveaway.findFirst({ where: { guildId: interaction.guildId!, messageId } });
          if (!giveaway) {
            await interaction.reply({ content: 'Giveaway not found.', ephemeral: true });
            return;
          }
          await endGiveaway(interaction.client, giveaway.id);
          await interaction.reply({ content: '✅ Giveaway ended.', ephemeral: true });
        } else if (sub === 'reroll') {
          const messageId = interaction.options.getString('message_id', true);
          const giveaway = await prisma.giveaway.findFirst({ where: { guildId: interaction.guildId!, messageId } });
          if (!giveaway) {
            await interaction.reply({ content: 'Giveaway not found.', ephemeral: true });
            return;
          }
          await rerollGiveaway(interaction.client, giveaway.id);
          await interaction.reply({ content: '✅ Rerolled.', ephemeral: true });
        }
      }
    }
  ],
  components: [
    {
      prefix: 'giveaway_enter_',
      handleButton: async (interaction) => {
        const giveawayId = interaction.customId.replace('giveaway_enter_', '');
        const giveaway = await prisma.giveaway.findUnique({ where: { id: giveawayId } });
        if (!giveaway || giveaway.ended) {
          await interaction.reply({ content: 'This giveaway has ended.', ephemeral: true });
          return;
        }
        if (giveaway.requiredRoleId) {
          const member = interaction.member;
          const hasRole = member && 'roles' in member && (member.roles as import('discord.js').GuildMemberRoleManager).cache.has(giveaway.requiredRoleId);
          if (!hasRole) {
            await interaction.reply({ content: `You need the <@&${giveaway.requiredRoleId}> role to enter.`, ephemeral: true });
            return;
          }
        }
        if (giveaway.entrantIds.includes(interaction.user.id)) {
          await interaction.reply({ content: 'You already entered this giveaway!', ephemeral: true });
          return;
        }
        await prisma.giveaway.update({ where: { id: giveaway.id }, data: { entrantIds: { push: interaction.user.id } } });
        await interaction.reply({ content: '🎉 You entered the giveaway! Good luck!', ephemeral: true });
      }
    }
  ],
  onReady: (client) => {
    setInterval(() => sweepDueGiveaways(client).catch(() => undefined), 30_000);
  }
};
