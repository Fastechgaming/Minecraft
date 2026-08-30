import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  MessageFlags,
  PermissionFlagsBits,
  ChannelType,
  type TextChannel,
  type GuildMember,
  type ChatInputCommandInteraction,
  type ButtonInteraction
} from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { prisma } from '../../../database/prisma';
import { getGuildSettings, invalidateGuildSettings } from '../../../database/settingsCache';
import { isStaff } from '../../../services/permissions';
import { getOrCreateDefaultPanel, createTicketChannel, buildTranscript, countOpenTicketsForUser } from '../../../tickets/service';
import { recordAuditLog } from '../../../services/auditLog';

function ticketEmbed(number: number, openerId: string, claimedById?: string | null) {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`🎫 Ticket #${number}`)
    .setDescription(`Opened by <@${openerId}>.\nA staff member will be with you shortly.`)
    .addFields({ name: 'Claimed by', value: claimedById ? `<@${claimedById}>` : 'Unclaimed' })
    .setTimestamp(new Date());
}

function ticketButtons(ticketId: string, status: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ticket_claim_${ticketId}`).setLabel('Claim').setEmoji('🙋').setStyle(ButtonStyle.Primary).setDisabled(status !== 'open'),
    new ButtonBuilder().setCustomId(`ticket_close_${ticketId}`).setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`ticket_transcript_${ticketId}`).setLabel('Transcript').setEmoji('📄').setStyle(ButtonStyle.Secondary)
  );
}

async function requireGuildManage(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: '🚫 You need the Manage Server permission.', flags: MessageFlags.Ephemeral });
    return false;
  }
  return true;
}

export const ticketsModule: FeatureModule = {
  name: 'tickets',
  description: 'Panel-driven ticket system with categories, staff roles, claiming, transcripts, and open-ticket limits.',
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
    },
    {
      data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Manage tickets.')
        .addSubcommand((sub) => sub.setName('close').setDescription('Close the current ticket.'))
        .addSubcommand((sub) => sub.setName('closeall').setDescription('Close every open ticket.'))
        .addSubcommand((sub) =>
          sub.setName('add').setDescription('Add a user to this ticket.').addUserOption((o) => o.setName('user').setDescription('User to add').setRequired(true))
        )
        .addSubcommand((sub) =>
          sub
            .setName('remove')
            .setDescription('Remove a user from this ticket.')
            .addUserOption((o) => o.setName('user').setDescription('User to remove').setRequired(true))
        )
        .addSubcommand((sub) =>
          sub
            .setName('log')
            .setDescription('Set the channel ticket transcripts are sent to.')
            .addChannelOption((o) => o.setName('channel').setDescription('Log channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
        )
        .addSubcommand((sub) =>
          sub
            .setName('limit')
            .setDescription('Set the max number of open tickets per user.')
            .addIntegerOption((o) => o.setName('count').setDescription('Max concurrent tickets').setMinValue(1).setMaxValue(20).setRequired(true))
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
      module: 'tickets',
      execute: async (interaction) => {
        if (!interaction.guildId) return;
        const sub = interaction.options.getSubcommand();

        if (sub === 'log') {
          const channel = interaction.options.getChannel('channel', true);
          await prisma.guildSettings.upsert({
            where: { guildId: interaction.guildId },
            create: { guildId: interaction.guildId, ticketLogChannelId: channel.id },
            update: { ticketLogChannelId: channel.id }
          });
          invalidateGuildSettings(interaction.guildId);
          await interaction.reply({ content: `✅ Ticket transcripts will be sent to <#${channel.id}>.`, flags: MessageFlags.Ephemeral });
          return;
        }

        if (sub === 'limit') {
          const count = interaction.options.getInteger('count', true);
          await prisma.guildSettings.upsert({
            where: { guildId: interaction.guildId },
            create: { guildId: interaction.guildId, ticketMaxOpenPerUser: count },
            update: { ticketMaxOpenPerUser: count }
          });
          invalidateGuildSettings(interaction.guildId);
          await interaction.reply({ content: `✅ Members can now have up to ${count} open ticket(s) at once.`, flags: MessageFlags.Ephemeral });
          return;
        }

        const ticket = await prisma.ticket.findUnique({ where: { channelId: interaction.channelId } });

        if (sub === 'close') {
          if (!ticket) {
            await interaction.reply({ content: 'This is not a ticket channel.', flags: MessageFlags.Ephemeral });
            return;
          }
          await closeTicket(interaction.channel as TextChannel, ticket.id, interaction.user.id);
          await interaction.reply({ content: '🔒 Closing this ticket…', flags: MessageFlags.Ephemeral });
          return;
        }

        if (sub === 'closeall') {
          const open = await prisma.ticket.findMany({ where: { guildId: interaction.guildId, status: { not: 'closed' } } });
          await interaction.reply({ content: `🔒 Closing ${open.length} open ticket(s)…`, flags: MessageFlags.Ephemeral });
          for (const t of open) {
            const channel = await interaction.guild!.channels.fetch(t.channelId).catch(() => null);
            if (channel?.isTextBased()) await closeTicket(channel as TextChannel, t.id, interaction.user.id);
          }
          return;
        }

        if (sub === 'add' || sub === 'remove') {
          if (!ticket) {
            await interaction.reply({ content: 'This is not a ticket channel.', flags: MessageFlags.Ephemeral });
            return;
          }
          const user = interaction.options.getUser('user', true);
          const channel = interaction.channel as TextChannel;
          if (sub === 'add') {
            await channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
            await interaction.reply(`✅ Added ${user} to the ticket.`);
          } else {
            await channel.permissionOverwrites.delete(user.id).catch(() => undefined);
            await interaction.reply(`✅ Removed ${user} from the ticket.`);
          }
        }
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('ticketcat')
        .setDescription('Manage ticket categories.')
        .addSubcommand((sub) => sub.setName('list').setDescription('List all ticket categories.'))
        .addSubcommand((sub) =>
          sub
            .setName('add')
            .setDescription('Add a ticket category.')
            .addStringOption((o) => o.setName('label').setDescription('Category label').setRequired(true))
            .addStringOption((o) => o.setName('staff_role').setDescription('Staff role for this category'))
        )
        .addSubcommand((sub) =>
          sub.setName('remove').setDescription('Remove a ticket category.').addStringOption((o) => o.setName('label').setDescription('Category label').setRequired(true))
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
      module: 'tickets',
      execute: async (interaction) => {
        if (!interaction.guildId || !(await requireGuildManage(interaction))) return;
        const panel = await getOrCreateDefaultPanel(interaction.guildId);
        const sub = interaction.options.getSubcommand();

        if (sub === 'list') {
          const description = panel.categories.map((c) => `${c.emoji ?? '•'} **${c.label}**`).join('\n') || 'No categories yet.';
          await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('Ticket Categories').setDescription(description)], flags: MessageFlags.Ephemeral });
          return;
        }

        if (sub === 'add') {
          const label = interaction.options.getString('label', true);
          const roleId = interaction.options.getString('staff_role')?.replace(/\D/g, '');
          await prisma.ticketCategory.create({
            data: { panelId: panel.id, label, order: panel.categories.length, staffRoleIds: roleId ? [roleId] : [] }
          });
          await interaction.reply({ content: `✅ Added category **${label}**.`, flags: MessageFlags.Ephemeral });
          return;
        }

        if (sub === 'remove') {
          const label = interaction.options.getString('label', true);
          await prisma.ticketCategory.deleteMany({ where: { panelId: panel.id, label } });
          await interaction.reply({ content: `✅ Removed category **${label}**.`, flags: MessageFlags.Ephemeral });
        }
      }
    }
  ],
  components: [
    {
      prefix: 'ticket_open_select',
      select: async (interaction) => {
        if (!interaction.guildId) return;
        const categoryId = interaction.values[0]!;
        const settings = await getGuildSettings(interaction.guildId);

        const openCount = await countOpenTicketsForUser(interaction.guildId, interaction.user.id);
        if (openCount >= settings.ticketMaxOpenPerUser) {
          await interaction.reply({
            content: `🚫 You already have ${openCount} open ticket(s), which is the limit for this server.`,
            flags: MessageFlags.Ephemeral
          });
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
      prefix: 'ticket_claim_',
      button: async (interaction) => {
        if (!interaction.guildId) return;
        const ticketId = interaction.customId.replace('ticket_claim_', '');
        const settings = await getGuildSettings(interaction.guildId);
        if (!isStaff(interaction.member as GuildMember, settings)) {
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
        if (!isStaff(interaction.member as GuildMember, settings)) {
          await interaction.reply({ content: '🚫 Only staff can close tickets.', flags: MessageFlags.Ephemeral });
          return;
        }
        await interaction.deferReply();
        await closeTicket(interaction.channel as TextChannel, ticketId, interaction.user.id, interaction);
      }
    },
    {
      prefix: 'ticket_transcript_',
      button: async (interaction) => {
        const channel = interaction.channel as TextChannel;
        const transcript = await buildTranscript(channel);
        const attachment = new AttachmentBuilder(Buffer.from(transcript, 'utf-8'), { name: 'transcript.txt' });
        await interaction.reply({ files: [attachment], flags: MessageFlags.Ephemeral });
      }
    }
  ]
};

async function closeTicket(
  channel: TextChannel,
  ticketId: string,
  closedById: string,
  interaction?: ButtonInteraction
): Promise<void> {
  const transcript = await buildTranscript(channel);
  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data: { status: 'closed', closedAt: new Date(), closedById, transcript }
  });

  const settings = await getGuildSettings(ticket.guildId);
  const attachment = new AttachmentBuilder(Buffer.from(transcript, 'utf-8'), { name: `ticket-${ticket.number}-transcript.txt` });

  await recordAuditLog(channel.client, {
    guildId: ticket.guildId,
    type: 'ticket',
    action: 'closed',
    userId: ticket.openerId,
    moderatorId: closedById,
    channelId: channel.id,
    details: { Ticket: `#${ticket.number}` }
  });

  if (settings.ticketLogChannelId) {
    const logChannel = await channel.guild.channels.fetch(settings.ticketLogChannelId).catch(() => null);
    if (logChannel?.isTextBased()) {
      await (logChannel as TextChannel).send({ content: `🔒 Ticket #${ticket.number} closed by <@${closedById}>.`, files: [attachment] }).catch(() => undefined);
    }
  }

  const opener = await channel.client.users.fetch(ticket.openerId).catch(() => null);
  await opener?.send({ content: `Your ticket #${ticket.number} was closed. Here is your transcript:`, files: [attachment] }).catch(() => undefined);

  if (interaction) {
    await interaction.editReply({ content: `🔒 Ticket closed by <@${closedById}>. Archiving in 10 seconds...`, files: [attachment] });
  }

  setTimeout(() => channel.delete().catch(() => undefined), 10_000);
}
