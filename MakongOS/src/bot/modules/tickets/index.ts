import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  AttachmentBuilder,
  type TextChannel
} from 'discord.js';
import type { FeatureModule } from '../../../types/command';
import { prisma } from '../../../database/prisma';
import { getGuildSettings } from '../../../database/settingsCache';
import { isStaff } from '../../../services/permissions';
import { createTicketChannel, countOpenTicketsForUser } from '../../../tickets/service';
import { buildHtmlTranscript } from '../../../tickets/transcript';
import { logAudit } from '../../../services/auditLog';

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

export const ticketsModule: FeatureModule = {
  name: 'tickets',
  description: 'Multi-panel tickets with custom forms, claiming, and HTML transcripts, plus DM modmail.',
  commands: [
    {
      data: new SlashCommandBuilder()
        .setName('ticketcat')
        .setDescription('Manage ticket categories')
        .addSubcommand((s) =>
          s
            .setName('add')
            .setDescription('Add a ticket category')
            .addStringOption((o) => o.setName('name').setDescription('Category name').setRequired(true))
            .addChannelOption((o) => o.setName('parent').setDescription('Discord category to create tickets under').setRequired(true).addChannelTypes(ChannelType.GuildCategory))
            .addStringOption((o) => o.setName('emoji').setDescription('Emoji').setRequired(false))
            .addRoleOption((o) => o.setName('staff_role').setDescription('Role that can see these tickets').setRequired(false))
        )
        .addSubcommand((s) => s.setName('remove').setDescription('Remove a ticket category').addStringOption((o) => o.setName('name').setDescription('Category name').setRequired(true)))
        .addSubcommand((s) => s.setName('list').setDescription('List ticket categories')),
      execute: async (interaction) => {
        const settings = await getGuildSettings(interaction.guildId!);
        const member = interaction.member;
        if (!member || !('roles' in member) || !isStaff(member as never, settings)) {
          await interaction.reply({ content: 'You need a staff role to manage ticket categories.', ephemeral: true });
          return;
        }
        const sub = interaction.options.getSubcommand();

        if (sub === 'add') {
          const name = interaction.options.getString('name', true);
          const parent = interaction.options.getChannel('parent', true);
          const emoji = interaction.options.getString('emoji') ?? '🎫';
          const staffRole = interaction.options.getRole('staff_role');
          await prisma.ticketCategory.create({
            data: { guildId: interaction.guildId!, name, emoji, categoryChannelId: parent.id, staffRoleIds: staffRole ? [staffRole.id] : [] }
          });
          await interaction.reply(`✅ Added ticket category **${name}**.`);
        } else if (sub === 'remove') {
          const name = interaction.options.getString('name', true);
          const deleted = await prisma.ticketCategory.deleteMany({ where: { guildId: interaction.guildId!, name } });
          await interaction.reply(deleted.count > 0 ? `🗑️ Removed category **${name}**.` : `No category named **${name}**.`);
        } else {
          const categories = await prisma.ticketCategory.findMany({ where: { guildId: interaction.guildId! } });
          if (categories.length === 0) {
            await interaction.reply('No ticket categories yet — add one with `/ticketcat add`.');
            return;
          }
          await interaction.reply(categories.map((c) => `${c.emoji} **${c.name}**`).join('\n'));
        }
      }
    },
    {
      data: new SlashCommandBuilder()
        .setName('ticket-panel')
        .setDescription('Post a ticket panel in this channel')
        .addStringOption((o) => o.setName('title').setDescription('Panel title').setRequired(false))
        .addStringOption((o) => o.setName('description').setDescription('Panel description').setRequired(false)),
      execute: async (interaction) => {
        const settings = await getGuildSettings(interaction.guildId!);
        const member = interaction.member;
        if (!member || !('roles' in member) || !isStaff(member as never, settings)) {
          await interaction.reply({ content: 'You need a staff role to post a ticket panel.', ephemeral: true });
          return;
        }
        const categories = await prisma.ticketCategory.findMany({ where: { guildId: interaction.guildId! } });
        if (categories.length === 0) {
          await interaction.reply({ content: 'Add at least one category first with `/ticketcat add`.', ephemeral: true });
          return;
        }
        const title = interaction.options.getString('title') ?? 'Support';
        const description = interaction.options.getString('description') ?? 'Select a category below to open a ticket.';

        const embed = new EmbedBuilder().setTitle(title).setDescription(description).setColor(0x5865f2);
        const select = new StringSelectMenuBuilder()
          .setCustomId('ticket_open_select')
          .setPlaceholder('Select a category...')
          .addOptions(categories.map((c) => ({ label: c.name, value: c.id, emoji: c.emoji })));
        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

        const message = await (interaction.channel as TextChannel).send({ embeds: [embed], components: [row] });
        await prisma.ticketPanel.create({ data: { guildId: interaction.guildId!, channelId: interaction.channelId, messageId: message.id, title, description } });
        await interaction.reply({ content: '✅ Panel posted.', ephemeral: true });
      }
    },
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
      handleSelect: async (interaction) => {
        const categoryId = interaction.values[0];
        const category = await prisma.ticketCategory.findUnique({ where: { id: categoryId } });
        if (!category) {
          await interaction.reply({ content: 'That category no longer exists.', ephemeral: true });
          return;
        }
        const settings = await getGuildSettings(interaction.guildId!);
        const openCount = await countOpenTicketsForUser(interaction.guildId!, interaction.user.id);
        if (openCount >= settings.ticketMaxOpenPerUser) {
          await interaction.reply({ content: `You already have ${openCount} open ticket(s). Close one before opening another.`, ephemeral: true });
          return;
        }

        const fields = (category.formFields as unknown as { label: string; style: 'short' | 'paragraph'; required: boolean }[]) ?? [];
        if (fields.length > 0) {
          const modal = new ModalBuilder().setCustomId(`ticket_form_${category.id}`).setTitle(`New Ticket — ${category.name}`.slice(0, 45));
          for (const [i, field] of fields.slice(0, 5).entries()) {
            const input = new TextInputBuilder()
              .setCustomId(`field_${i}`)
              .setLabel(field.label.slice(0, 45))
              .setStyle(field.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
              .setRequired(field.required);
            modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
          }
          await interaction.showModal(modal);
          return;
        }

        await interaction.deferReply({ ephemeral: true });
        const { ticket, channel } = await createTicketChannel(interaction.guild!, { categoryId: category.id, opener: interaction.user });
        const embed = new EmbedBuilder().setTitle(`Ticket #${ticket.number}`).setDescription(`${interaction.user} — a member of staff will be with you shortly.`).setColor(0x5865f2);
        await channel.send({ content: category.staffRoleIds.map((r) => `<@&${r}>`).join(' ') || undefined, embeds: [embed], components: [ticketButtons(false)] });
        await logAudit(interaction.guildId!, 'ticket', `Ticket #${ticket.number} opened by ${interaction.user.tag}`, interaction.user.id);
        await interaction.editReply(`✅ Ticket opened: ${channel}`);
      }
    },
    {
      prefix: 'ticket_form_',
      handleModal: async (interaction) => {
        const categoryId = interaction.customId.replace('ticket_form_', '');
        const category = await prisma.ticketCategory.findUnique({ where: { id: categoryId } });
        if (!category) {
          await interaction.reply({ content: 'That category no longer exists.', ephemeral: true });
          return;
        }
        const fields = (category.formFields as unknown as { label: string }[]) ?? [];
        const responses: Record<string, string> = {};
        fields.forEach((f, i) => {
          responses[f.label] = interaction.fields.getTextInputValue(`field_${i}`);
        });

        await interaction.deferReply({ ephemeral: true });
        const { ticket, channel } = await createTicketChannel(interaction.guild!, { categoryId: category.id, opener: interaction.user, formResponses: responses });
        const embed = new EmbedBuilder()
          .setTitle(`Ticket #${ticket.number}`)
          .setDescription(`${interaction.user} — a member of staff will be with you shortly.`)
          .addFields(Object.entries(responses).map(([name, value]) => ({ name, value: value || '—' })))
          .setColor(0x5865f2);
        await channel.send({ content: category.staffRoleIds.map((r) => `<@&${r}>`).join(' ') || undefined, embeds: [embed], components: [ticketButtons(false)] });
        await logAudit(interaction.guildId!, 'ticket', `Ticket #${ticket.number} opened by ${interaction.user.tag}`, interaction.user.id);
        await interaction.editReply(`✅ Ticket opened: ${channel}`);
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
