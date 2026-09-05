import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  AttachmentBuilder,
  type GuildMember,
  type TextChannel,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
  type ModalSubmitInteraction
} from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { prisma } from '../../../database/prisma';
import { getGuildSettings } from '../../../database/settingsCache';
import { isStaff } from '../../../services/permissions';
import { createTicketChannel, countOpenTicketsForUser, canUseTicketOption } from '../../../tickets/service';
import { buildHtmlTranscript } from '../../../tickets/transcript';
import { logAudit } from '../../../services/auditLog';
import { parseQuestions, type TicketQuestion } from '../../../tickets/panelTypes';

function ticketButtons(claimed: boolean): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('ticket_claim').setLabel(claimed ? 'Claimed' : 'Claim').setStyle(ButtonStyle.Primary).setDisabled(claimed),
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Close').setStyle(ButtonStyle.Danger)
  );
}

async function closeTicketChannel(channel: TextChannel, closedById: string) {
  const ticket = await prisma.ticket.findFirst({ where: { channelId: channel.id, status: { not: 'closed' } } });
  if (!ticket) return;
  const settings = await getGuildSettings(channel.guildId);

  const html = await buildHtmlTranscript(channel, `Ticket #${ticket.number} — ${ticket.openerTag}`);
  const file = new AttachmentBuilder(Buffer.from(html, 'utf8'), { name: `ticket-${ticket.number}-transcript.html` });

  if (settings.ticketLogChannelId) {
    const logChannel = await channel.guild.channels.fetch(settings.ticketLogChannelId).catch(() => null);
    if (logChannel?.isTextBased()) {
      await logChannel.send({ content: `📁 Ticket #${ticket.number} closed by <@${closedById}> (opened by ${ticket.openerTag}).`, files: [file] }).catch(() => undefined);
    }
  }

  const opener = await channel.client.users.fetch(ticket.openerId).catch(() => null);
  await opener?.send({ content: `Your ticket #${ticket.number} in **${channel.guild.name}** was closed.`, files: [file] }).catch(() => undefined);

  await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'closed', closedAt: new Date() } });
  await logAudit(channel.guildId, 'ticket', `Ticket #${ticket.number} closed`, closedById, { ticketNumber: ticket.number });
  await channel.delete().catch(() => undefined);
}

/** Up to 5 active questions from a category, in order — Discord modals cap at 5 text inputs. */
function activeQuestions(category: { formFields: unknown }): TicketQuestion[] {
  return parseQuestions(category.formFields)
    .filter((q) => q.active)
    .slice(0, 5);
}

async function openTicketOrShowModal(interaction: ButtonInteraction | StringSelectMenuInteraction, categoryId: string): Promise<void> {
  const category = await prisma.ticketCategory.findUnique({ where: { id: categoryId } });
  if (!category) {
    await interaction.reply({ content: 'That ticket option no longer exists.', ephemeral: true });
    return;
  }
  const settings = await getGuildSettings(interaction.guildId!);
  const member = interaction.member as GuildMember;
  if (!canUseTicketOption(member.roles.cache.map((r) => r.id), category, settings.ticketBlockedRoleIds)) {
    await interaction.reply({ content: "You don't have access to this ticket option.", ephemeral: true });
    return;
  }
  const openCount = await countOpenTicketsForUser(interaction.guildId!, interaction.user.id);
  if (openCount >= settings.ticketMaxOpenPerUser) {
    await interaction.reply({ content: `You already have ${openCount} open ticket(s). Close one before opening another.`, ephemeral: true });
    return;
  }

  const questions = activeQuestions(category);
  if (questions.length > 0) {
    const modal = new ModalBuilder().setCustomId(`ticket_form_${category.id}`).setTitle(`New Ticket — ${category.name}`.slice(0, 45));
    for (const q of questions) {
      const input = new TextInputBuilder()
        .setCustomId(`q_${q.id}`)
        .setLabel(q.label.slice(0, 45))
        .setStyle(q.type === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setRequired(q.required);
      if (q.helperText) input.setPlaceholder(q.helperText.slice(0, 100));
      if (typeof q.minLength === 'number') input.setMinLength(Math.max(0, Math.min(4000, q.minLength)));
      if (typeof q.maxLength === 'number') input.setMaxLength(Math.max(1, Math.min(4000, q.maxLength)));
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    }
    await interaction.showModal(modal);
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  await finishOpeningTicket(interaction, category.id, {});
}

async function finishOpeningTicket(
  interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
  categoryId: string,
  formResponses: Record<string, string>
): Promise<void> {
  const { ticket, channel, category, staffRoleIds } = await createTicketChannel(interaction.guild!, { categoryId, opener: interaction.user, formResponses });

  const description = category?.customEmbedContent || `${interaction.user} — a member of staff will be with you shortly.`;
  const embed = new EmbedBuilder()
    .setTitle(`Ticket #${ticket.number}`)
    .setDescription(description)
    .addFields(Object.entries(formResponses).map(([name, value]) => ({ name, value: value || '—' })))
    .setColor(0x22c55e);

  const pingRoleIds = category ? (category.useTicketRolesAsPing ? staffRoleIds : category.customPingRoleIds) : [];
  await channel.send({
    content: [pingRoleIds.map((r) => `<@&${r}>`).join(' ') || undefined, category?.customTicketMessage || undefined].filter(Boolean).join('\n') || undefined,
    embeds: [embed],
    components: [ticketButtons(false)]
  });
  await logAudit(interaction.guildId!, 'ticket', `Ticket #${ticket.number} opened by ${interaction.user.tag}`, interaction.user.id);
  await interaction.editReply(`✅ Ticket opened: ${channel}`);
}

export const ticketsModule: FeatureModule = {
  name: 'tickets',
  description: 'Multi-panel tickets designed on the dashboard — custom embeds, buttons/dropdowns, questions, and roles — plus claiming, HTML transcripts, and DM modmail.',
  commands: [
    {
      data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Ticket actions for the current ticket channel')
        .addSubcommand((s) => s.setName('close').setDescription('Close this ticket'))
        .addSubcommand((s) => s.setName('claim').setDescription('Claim this ticket'))
        .addSubcommand((s) => s.setName('add').setDescription('Add a member to this ticket').addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)))
        .addSubcommand((s) => s.setName('remove').setDescription('Remove a member from this ticket').addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))),
      execute: async (interaction) => {
        const ticket = await prisma.ticket.findFirst({ where: { channelId: interaction.channelId, status: { not: 'closed' } } });
        if (!ticket) {
          await interaction.reply({ content: 'This is not an open ticket channel.', ephemeral: true });
          return;
        }
        const settings = await getGuildSettings(interaction.guildId!);
        const member = interaction.member;
        const staff = member && 'roles' in member && isStaff(member as never, settings);
        const sub = interaction.options.getSubcommand();

        if (sub === 'close') {
          await interaction.reply('🔒 Closing this ticket...');
          await closeTicketChannel(interaction.channel as TextChannel, interaction.user.id);
          return;
        }
        if (!staff) {
          await interaction.reply({ content: 'Only staff can use that.', ephemeral: true });
          return;
        }
        if (sub === 'claim') {
          await prisma.ticket.update({ where: { id: ticket.id }, data: { claimedById: interaction.user.id, status: 'claimed' } });
          await interaction.reply(`🙋 ${interaction.user} claimed this ticket.`);
        } else if (sub === 'add') {
          const user = interaction.options.getUser('user', true);
          await (interaction.channel as TextChannel).permissionOverwrites.create(user.id, { ViewChannel: true, SendMessages: true });
          await interaction.reply(`✅ Added ${user} to the ticket.`);
        } else {
          const user = interaction.options.getUser('user', true);
          await (interaction.channel as TextChannel).permissionOverwrites.delete(user.id).catch(() => undefined);
          await interaction.reply(`✅ Removed ${user} from the ticket.`);
        }
      }
    },
    {
      data: new SlashCommandBuilder().setName('modmail-close').setDescription('Close the current modmail thread (staff only, run in the modmail channel)'),
      execute: async (interaction) => {
        const settings = await getGuildSettings(interaction.guildId!);
        const member = interaction.member;
        if (!member || !('roles' in member) || !isStaff(member as never, settings)) {
          await interaction.reply({ content: 'You need a staff role to close modmail.', ephemeral: true });
          return;
        }
        const thread = await prisma.modmailThread.findFirst({ where: { channelId: interaction.channelId, status: 'open' } });
        if (!thread) {
          await interaction.reply({ content: 'This is not an open modmail channel.', ephemeral: true });
          return;
        }
        await prisma.modmailThread.update({ where: { id: thread.id }, data: { status: 'closed', closedAt: new Date() } });
        const user = await interaction.client.users.fetch(thread.userId).catch(() => null);
        await user?.send(`Your modmail conversation with **${interaction.guild!.name}** was closed by staff.`).catch(() => undefined);
        await interaction.reply('🔒 Modmail thread closed.');
        setTimeout(() => (interaction.channel as TextChannel).delete().catch(() => undefined), 3000);
      }
    }
  ],
  components: [
    {
      prefix: 'ticket_open_select',
      handleSelect: async (interaction) => openTicketOrShowModal(interaction, interaction.values[0])
    },
    {
      prefix: 'ticket_open_btn_',
      handleButton: async (interaction) => openTicketOrShowModal(interaction, interaction.customId.replace('ticket_open_btn_', ''))
    },
    {
      prefix: 'ticket_form_',
      handleModal: async (interaction) => {
        const categoryId = interaction.customId.replace('ticket_form_', '');
        const category = await prisma.ticketCategory.findUnique({ where: { id: categoryId } });
        if (!category) {
          await interaction.reply({ content: 'That ticket option no longer exists.', ephemeral: true });
          return;
        }
        const questions = activeQuestions(category);
        const responses: Record<string, string> = {};
        for (const q of questions) {
          responses[q.label] = interaction.fields.getTextInputValue(`q_${q.id}`);
        }
        await interaction.deferReply({ ephemeral: true });
        await finishOpeningTicket(interaction, category.id, responses);
      }
    },
    {
      prefix: 'ticket_claim',
      handleButton: async (interaction) => {
        const ticket = await prisma.ticket.findFirst({ where: { channelId: interaction.channelId, status: { not: 'closed' } } });
        if (!ticket) return;
        await prisma.ticket.update({ where: { id: ticket.id }, data: { claimedById: interaction.user.id, status: 'claimed' } });
        await interaction.update({ components: [ticketButtons(true)] });
        await interaction.followUp(`🙋 ${interaction.user} claimed this ticket.`);
      }
    },
    {
      prefix: 'ticket_close',
      handleButton: async (interaction) => {
        await interaction.update({ content: '🔒 Closing this ticket...', components: [] });
        await closeTicketChannel(interaction.channel as TextChannel, interaction.user.id);
      }
    }
  ],
  events: {
    messageCreate: async (message) => {
      if (message.author.bot) return;

      if (message.guildId) {
        // Staff replying inside a modmail channel — forward to the user's DM.
        const thread = await prisma.modmailThread.findFirst({ where: { channelId: message.channelId, status: 'open' } });
        if (!thread || !message.content) return;
        const user = await message.client.users.fetch(thread.userId).catch(() => null);
        if (!user) return;
        const embed = new EmbedBuilder().setAuthor({ name: `${message.author.tag} (Staff)`, iconURL: message.author.displayAvatarURL() }).setDescription(message.content).setColor(0x2ecc71);
        const sent = await user.send({ embeds: [embed], files: [...message.attachments.values()] }).catch(() => null);
        await message.react(sent ? '✅' : '❌').catch(() => undefined);
        return;
      }

      const existingThread = await prisma.modmailThread.findFirst({ where: { userId: message.author.id, status: 'open' } });
      if (existingThread) {
        const channel = await message.client.channels.fetch(existingThread.channelId).catch(() => null);
        if (channel?.isTextBased() && 'send' in channel) {
          const embed = new EmbedBuilder().setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() }).setDescription(message.content || '*attachment*').setColor(0x5865f2);
          await channel.send({ embeds: [embed], files: [...message.attachments.values()] }).catch(() => undefined);
        }
        await message.react('✅').catch(() => undefined);
        return;
      }

      const eligibleGuilds = [];
      for (const guild of message.client.guilds.cache.values()) {
        const settings = await getGuildSettings(guild.id);
        if (!settings.modmailEnabled) continue;
        const member = await guild.members.fetch(message.author.id).catch(() => null);
        if (member) eligibleGuilds.push({ guild, settings });
      }

      if (eligibleGuilds.length === 0) return;
      const { guild, settings } = eligibleGuilds[0];
      if (eligibleGuilds.length > 1) {
        await message
          .reply(`You're a member of multiple servers with modmail enabled. Messaging **${guild.name}** by default. Contact staff directly if you meant a different server.`)
          .catch(() => undefined);
      }

      const channel = await guild.channels.create({
        name: `modmail-${message.author.username}`.slice(0, 90),
        type: ChannelType.GuildText,
        parent: settings.modmailCategoryId ?? undefined
      });
      await prisma.modmailThread.create({ data: { guildId: guild.id, userId: message.author.id, userTag: message.author.tag, channelId: channel.id } });
      const introEmbed = new EmbedBuilder()
        .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
        .setTitle('New Modmail Thread')
        .setDescription(message.content || '*attachment*')
        .setColor(0x5865f2);
      await channel.send({ embeds: [introEmbed], files: [...message.attachments.values()] });
      await message.reply(`✅ Your message was sent to the **${guild.name}** staff team. They'll reply here.`).catch(() => undefined);
      await logAudit(guild.id, 'modmail', `Modmail thread opened by ${message.author.tag}`, message.author.id);
    }
  },
  onReady: (client) => {
    const reminded = new Set<string>();
    setInterval(async () => {
      const openTickets = await prisma.ticket.findMany({ where: { status: 'open' } });
      for (const ticket of openTickets) {
        if (reminded.has(ticket.id)) continue;
        const settings = await getGuildSettings(ticket.guildId);
        const ageHours = (Date.now() - ticket.createdAt.getTime()) / 3_600_000;
        if (ageHours < settings.ticketReminderHours) continue;
        const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
        if (channel?.isTextBased() && 'send' in channel) {
          await channel.send(`⏰ This ticket has been open for over ${settings.ticketReminderHours}h with no staff claim — <@${ticket.openerId}>, staff will be with you soon.`).catch(() => undefined);
        }
        reminded.add(ticket.id);
      }
    }, 10 * 60_000);
  }
};
