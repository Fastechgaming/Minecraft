import { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits, type TextChannel, type GuildMember } from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { prisma } from '../../../database/prisma';
import { getGuildSettings } from '../../../database/settingsCache';
import { isStaff } from '../../../services/permissions';
import { recordAuditLog } from '../../../services/auditLog';

const UPVOTE = '👍';
const DOWNVOTE = '👎';

function suggestionEmbed(authorTag: string, authorAvatar: string, content: string, status: string, upvotes: number, downvotes: number, reason?: string | null) {
  const color = status === 'approved' ? 0x23a559 : status === 'rejected' ? 0xda373c : 0x5865f2;
  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: authorTag, iconURL: authorAvatar })
    .setDescription(content)
    .addFields({ name: '👍 Upvotes', value: `${upvotes}`, inline: true }, { name: '👎 Downvotes', value: `${downvotes}`, inline: true }, { name: 'Status', value: status, inline: true })
    .setTimestamp(new Date());
  if (reason) embed.addFields({ name: 'Staff Note', value: reason });
  return embed;
}

export const suggestionsModule: FeatureModule = {
  name: 'suggestions',
  description: 'Member suggestions with upvote/downvote reactions and staff approve/reject.',
  commands: [
    {
      data: new SlashCommandBuilder()
        .setName('suggest')
        .setDescription('Submit a suggestion for the server.')
        .addStringOption((o) => o.setName('suggestion').setDescription('Your suggestion').setRequired(true).setMaxLength(1000)),
      module: 'suggestions',
      defaultCooldownSec: 30,
      execute: async (interaction) => {
        if (!interaction.guildId) return;
        const settings = await getGuildSettings(interaction.guildId);
        if (!settings.suggestionsEnabled) {
          await interaction.reply({ content: '🚫 Suggestions are disabled on this server.', flags: MessageFlags.Ephemeral });
          return;
        }

        const channelId = settings.suggestionsChannelId ?? interaction.channelId;
        const channel = await interaction.guild!.channels.fetch(channelId).catch(() => null);
        if (!channel?.isTextBased()) {
          await interaction.reply({ content: '🚫 The suggestions channel is not configured correctly.', flags: MessageFlags.Ephemeral });
          return;
        }

        const content = interaction.options.getString('suggestion', true);
        const embed = suggestionEmbed(interaction.user.tag, interaction.user.displayAvatarURL(), content, 'pending', 0, 0);
        const message = await (channel as TextChannel).send({ embeds: [embed] });
        await message.react(UPVOTE).catch(() => undefined);
        await message.react(DOWNVOTE).catch(() => undefined);

        await prisma.suggestion.create({
          data: { guildId: interaction.guildId, channelId: message.channelId, messageId: message.id, userId: interaction.user.id, content }
        });

        await recordAuditLog(interaction.client, {
          guildId: interaction.guildId,
          type: 'suggestion',
          action: 'submitted',
          userId: interaction.user.id,
          channelId: message.channelId
        });

        await interaction.reply({ content: `✅ Suggestion posted in ${channel}!`, flags: MessageFlags.Ephemeral });
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('suggestion')
        .setDescription('Review a suggestion.')
        .addSubcommand((sub) =>
          sub
            .setName('approve')
            .setDescription('Approve a suggestion.')
            .addStringOption((o) => o.setName('message_id').setDescription('The suggestion message ID').setRequired(true))
            .addStringOption((o) => o.setName('reason').setDescription('Optional note'))
        )
        .addSubcommand((sub) =>
          sub
            .setName('reject')
            .setDescription('Reject a suggestion.')
            .addStringOption((o) => o.setName('message_id').setDescription('The suggestion message ID').setRequired(true))
            .addStringOption((o) => o.setName('reason').setDescription('Optional note'))
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
      module: 'suggestions',
      execute: async (interaction) => {
        if (!interaction.guildId) return;
        const settings = await getGuildSettings(interaction.guildId);
        if (!isStaff(interaction.member as GuildMember, settings)) {
          await interaction.reply({ content: '🚫 Only staff can review suggestions.', flags: MessageFlags.Ephemeral });
          return;
        }

        const sub = interaction.options.getSubcommand();
        const messageId = interaction.options.getString('message_id', true);
        const reason = interaction.options.getString('reason') ?? undefined;
        const status = sub === 'approve' ? 'approved' : 'rejected';

        const suggestion = await prisma.suggestion.findFirst({ where: { guildId: interaction.guildId, messageId } });
        if (!suggestion) {
          await interaction.reply({ content: '❌ No suggestion found with that message ID.', flags: MessageFlags.Ephemeral });
          return;
        }

        const channel = await interaction.guild!.channels.fetch(suggestion.channelId).catch(() => null);
        const message = channel?.isTextBased() ? await (channel as TextChannel).messages.fetch(messageId).catch(() => null) : null;

        let upvotes = suggestion.upvotes;
        let downvotes = suggestion.downvotes;
        if (message) {
          upvotes = (message.reactions.cache.get(UPVOTE)?.count ?? 1) - 1;
          downvotes = (message.reactions.cache.get(DOWNVOTE)?.count ?? 1) - 1;
        }

        await prisma.suggestion.update({
          where: { id: suggestion.id },
          data: { status, upvotes, downvotes, reviewedById: interaction.user.id, reviewReason: reason, reviewedAt: new Date() }
        });

        if (message) {
          const author = await interaction.client.users.fetch(suggestion.userId).catch(() => null);
          const embed = suggestionEmbed(author?.tag ?? suggestion.userId, author?.displayAvatarURL() ?? '', suggestion.content, status, upvotes, downvotes, reason);
          await message.edit({ embeds: [embed] }).catch(() => undefined);
        }

        await recordAuditLog(interaction.client, {
          guildId: interaction.guildId,
          type: 'suggestion',
          action: status,
          userId: suggestion.userId,
          moderatorId: interaction.user.id,
          channelId: suggestion.channelId
        });

        await interaction.reply({ content: `✅ Suggestion ${status}.`, flags: MessageFlags.Ephemeral });
      }
    }
  ]
};
