import { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits, ChannelType, type TextChannel } from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { prisma } from '../../../database/prisma';
import { getGuildSettings } from '../../../database/settingsCache';
import { parseDuration, createGiveaway, endGiveaway, rerollGiveaway, sweepDueGiveaways } from '../../../giveaways/service';

export const giveawaysModule: FeatureModule = {
  name: 'giveaways',
  description: 'Reaction-based giveaways with scheduled auto-end and rerolls.',
  commands: [
    {
      data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Manage giveaways.')
        .addSubcommand((sub) =>
          sub
            .setName('start')
            .setDescription('Start a new giveaway.')
            .addStringOption((o) => o.setName('prize').setDescription('What are you giving away?').setRequired(true))
            .addStringOption((o) => o.setName('duration').setDescription('e.g. 30m, 2h, 1d').setRequired(true))
            .addIntegerOption((o) => o.setName('winners').setDescription('Number of winners').setMinValue(1).setMaxValue(20))
            .addChannelOption((o) => o.setName('channel').setDescription('Channel to post in').addChannelTypes(ChannelType.GuildText))
        )
        .addSubcommand((sub) => sub.setName('end').setDescription('End a giveaway early.').addStringOption((o) => o.setName('message_id').setDescription('Giveaway message ID').setRequired(true)))
        .addSubcommand((sub) => sub.setName('reroll').setDescription('Pick new winner(s) for an ended giveaway.').addStringOption((o) => o.setName('message_id').setDescription('Giveaway message ID').setRequired(true)))
        .addSubcommand((sub) => sub.setName('list').setDescription('List active giveaways.'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
      module: 'giveaways',
      execute: async (interaction) => {
        if (!interaction.guildId) return;
        const settings = await getGuildSettings(interaction.guildId);
        if (!settings.giveawaysEnabled) {
          await interaction.reply({ content: '🚫 Giveaways are disabled on this server.', flags: MessageFlags.Ephemeral });
          return;
        }

        const sub = interaction.options.getSubcommand();

        if (sub === 'start') {
          const prize = interaction.options.getString('prize', true);
          const durationInput = interaction.options.getString('duration', true);
          const winners = interaction.options.getInteger('winners') ?? 1;
          const channel = (interaction.options.getChannel('channel') as TextChannel | null) ?? (interaction.channel as TextChannel);

          const durationMs = parseDuration(durationInput);
          if (!durationMs || durationMs < 30_000) {
            await interaction.reply({ content: '🚫 Invalid duration. Use a format like `30m`, `2h`, or `1d` (minimum 30s).', flags: MessageFlags.Ephemeral });
            return;
          }

          await createGiveaway(channel, prize, winners, interaction.user.id, durationMs);
          await interaction.reply({ content: `🎉 Giveaway for **${prize}** started in ${channel}!`, flags: MessageFlags.Ephemeral });
          return;
        }

        const messageId = interaction.options.getString('message_id');

        if (sub === 'end') {
          const giveaway = await prisma.giveaway.findFirst({ where: { guildId: interaction.guildId, messageId: messageId! } });
          if (!giveaway) {
            await interaction.reply({ content: '❌ No giveaway found with that message ID.', flags: MessageFlags.Ephemeral });
            return;
          }
          await endGiveaway(interaction.client, giveaway.id);
          await interaction.reply({ content: '✅ Giveaway ended.', flags: MessageFlags.Ephemeral });
          return;
        }

        if (sub === 'reroll') {
          const giveaway = await prisma.giveaway.findFirst({ where: { guildId: interaction.guildId, messageId: messageId! } });
          if (!giveaway) {
            await interaction.reply({ content: '❌ No giveaway found with that message ID.', flags: MessageFlags.Ephemeral });
            return;
          }
          const winners = await rerollGiveaway(interaction.client, giveaway.id);
          await interaction.reply({
            content: winners.length ? `✅ Rerolled: ${winners.map((id) => `<@${id}>`).join(', ')}` : '❌ No valid entries to reroll from.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        if (sub === 'list') {
          const active = await prisma.giveaway.findMany({ where: { guildId: interaction.guildId, ended: false }, orderBy: { endsAt: 'asc' } });
          if (active.length === 0) {
            await interaction.reply({ content: 'No active giveaways.', flags: MessageFlags.Ephemeral });
            return;
          }
          const description = active.map((g) => `**${g.prize}** — ends <t:${Math.floor(g.endsAt.getTime() / 1000)}:R> · \`${g.messageId}\``).join('\n');
          await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf0b232).setTitle('🎉 Active Giveaways').setDescription(description)], flags: MessageFlags.Ephemeral });
        }
      }
    }
  ],
  onReady: async (ctx) => {
    setInterval(() => {
      void sweepDueGiveaways(ctx.client);
    }, 30_000).unref();
  }
};
