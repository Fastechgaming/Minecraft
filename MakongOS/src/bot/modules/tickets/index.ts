import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
  MessageFlags,
  PermissionFlagsBits,
  type TextChannel
} from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { prisma } from '../../../database/prisma';
import { getGuildSettings } from '../../../database/settingsCache';
import { isStaff } from '../../../services/permissions';
import { getOrCreateDefaultPanel, createTicketChannel, buildTranscript } from '../../../tickets/service';
import { recordAuditLog } from '../../../services/auditLog';

interface FormField {
  label: string;
  required?: boolean;
  placeholder?: string;
}

function ticketEmbed(number: number, openerId: string, claimedById?: string | null) {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`🎫 Ticket #${number}`)
    .setDescription(`Opened by <@${openerId}>.\nA staff member will be with you shortly.`)
    .addFields({ name: 'Claimed by', value: claimedById ? `<@${claimedById}>` : 'Unclaimed' })
    .setTimestamp(new Date());
}

function ticketButtons(ticketId: string, status: string) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ticket_claim_${ticketId}`).setLabel('Claim').setEmoji('🙋').setStyle(ButtonStyle.Primary).setDisabled(status !== 'open'),
    new ButtonBuilder().setCustomId(`ticket_close_${ticketId}`).setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`ticket_transcript_${ticketId}`).setLabel('Transcript').setEmoji('📄').setStyle(ButtonStyle.Secondary)
  );
  return row;
}

export const ticketsModule: FeatureModule = {
  name: 'tickets',
  description: 'Panel-driven ticket system with categories, forms, claiming, and exportable transcripts.',
  commands: [
    {
      data: new SlashCommandBuilder()
        .setName('ticket-panel')
        .setDescription('Post the support ticket panel in this channel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
      module: 'tickets',
      execute: async (interaction) => {
        if (!interaction.guildId || !interaction.channel?.isTextBased()) return;
        const panel = await getOrCreateDefaultPanel(interaction.guildId);

        const embed = new EmbedBuilder().setColor(panel.color as `#${string}`).setTitle(panel.title).setDescription(panel.description);

        const select = new StringSelectMenuBuilder()
          .setCustomId('ticket_open_select')
          .setPlaceholder('What do you need help with?')
          .addOptions(
            panel.categories
              .sort((a, b) => a.order - b.order)
              .map((c) => ({ label: c.label, value: c.id, emoji: c.emoji ?? undefined, description: c.description ?? undefined }))
          );

        const message = await (interaction.channel as TextChannel).send({
          embeds: [embed],
          components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)]
        });

        await prisma.ticketPanel.update({ where: { id: panel.id }, data: { channelId: message.channelId, messageId: message.id } });
        await interaction.reply({ content: '✅ Ticket panel posted.', flags: MessageFlags.Ephemeral });
      }
    }
  ],
  components: [
    {
      prefix: 'ticket_open_select',
      select: async (interaction) => {
        const categoryId = interaction.values[0];
        const category = await prisma.ticketCategory.findUnique({ where: { id: categoryId } });
        if (!category) return;

        const formFields = (category.formFields as FormField[] | null) ?? [];
        if (formFields.length > 0) {
          const modal = new ModalBuilder().setCustomId(`ticket_form_${categoryId}`).setTitle(category.label.slice(0, 45));
          for (const [i, field] of formFields.slice(0, 5).entries()) {
            modal.addComponents(
              new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                  .setCustomId(`field_${i}`)
                  .setLabel(field.label.slice(0, 45))
                  .setStyle(TextInputStyle.Paragraph)
                  .setRequired(field.required ?? true)
                  .setPlaceholder(field.placeholder ?? '')
              )
            );
          }
          await interaction.showModal(modal);
          return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const { ticket, channel } = await createTicketChannel(interaction.guild!, categoryId, {
          id: interaction.user.id,
          username: interaction.user.username
        });
        await channel.send({ embeds: [ticketEmbed(ticket.number, ticket.openerId)], components: [ticketButtons(ticket.id, ticket.status)] });
        await interaction.editReply(`✅ Ticket created: ${channel}`);
      }
    },
    {
      prefix: 'ticket_form_',
      modal: async (interaction) => {
        const categoryId = interaction.customId.replace('ticket_form_', '');
        const category = await prisma.ticketCategory.findUnique({ where: { id: categoryId } });
        const formFields = (category?.formFields as FormField[] | null) ?? [];

        const answers: Record<string, string> = {};
        formFields.forEach((field, i) => {
          answers[field.label] = interaction.fields.getTextInputValue(`field_${i}`);
        });

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const { ticket, channel } = await createTicketChannel(
          interaction.guild!,
          categoryId,
          { id: interaction.user.id, username: interaction.user.username },
          answers
        );

        const embed = ticketEmbed(ticket.number, ticket.openerId);
        if (Object.keys(answers).length) {
          embed.addFields(Object.entries(answers).map(([label, value]) => ({ name: label, value: value.slice(0, 1000) || '—' })));
        }
        await channel.send({ embeds: [embed], components: [ticketButtons(ticket.id, ticket.status)] });
        await interaction.editReply(`✅ Ticket created: ${channel}`);
      }
    },
    {
      prefix: 'ticket_claim_',
      button: async (interaction) => {
        if (!interaction.guildId) return;
        const ticketId = interaction.customId.replace('ticket_claim_', '');
        const settings = await getGuildSettings(interaction.guildId);
        if (!isStaff(interaction.member as never, settings)) {
          await interaction.reply({ content: '🚫 Only staff can claim tickets.', flags: MessageFlags.Ephemeral });
          return;
        }
        const ticket = await prisma.ticket.update({ where: { id: ticketId }, data: { claimedById: interaction.user.id, status: 'claimed' } });
        await interaction.update({ embeds: [ticketEmbed(ticket.number, ticket.openerId, ticket.claimedById)], components: [ticketButtons(ticket.id, ticket.status)] });
      }
    },
    {
      prefix: 'ticket_close_',
      button: async (interaction) => {
        if (!interaction.guildId) return;
        const ticketId = interaction.customId.replace('ticket_close_', '');
        const settings = await getGuildSettings(interaction.guildId);
        if (!isStaff(interaction.member as never, settings)) {
          await interaction.reply({ content: '🚫 Only staff can close tickets.', flags: MessageFlags.Ephemeral });
          return;
        }

        await interaction.deferReply();
        const channel = interaction.channel as TextChannel;
        const transcript = await buildTranscript(channel);
        const ticket = await prisma.ticket.update({
          where: { id: ticketId },
          data: { status: 'closed', closedAt: new Date(), closedById: interaction.user.id, transcript }
        });

        await recordAuditLog(interaction.client, {
          guildId: interaction.guildId,
          type: 'ticket',
          action: 'closed',
          userId: ticket.openerId,
          moderatorId: interaction.user.id,
          channelId: channel.id,
          details: { Ticket: `#${ticket.number}` }
        });

        const attachment = new AttachmentBuilder(Buffer.from(transcript, 'utf-8'), { name: `ticket-${ticket.number}-transcript.txt` });
        await interaction.editReply({ content: `🔒 Ticket closed by ${interaction.user}. Archiving in 10 seconds...`, files: [attachment] });

        const opener = await interaction.client.users.fetch(ticket.openerId).catch(() => null);
        await opener?.send({ content: `Your ticket #${ticket.number} was closed. Here is your transcript:`, files: [attachment] }).catch(() => undefined);

        setTimeout(() => channel.delete().catch(() => undefined), 10_000);
      }
    },
    {
      prefix: 'ticket_transcript_',
      button: async (interaction) => {
        const channel = interaction.channel as TextChannel;
        const transcript = await buildTranscript(channel);
        const attachment = new AttachmentBuilder(Buffer.from(transcript, 'utf-8'), { name: `transcript.txt` });
        await interaction.reply({ files: [attachment], flags: MessageFlags.Ephemeral });
      }
    }
  ]
};
