import {
  ChannelType,
  PermissionFlagsBits,
  type Guild,
  type TextChannel,
  type CategoryChannel
} from 'discord.js';
import { prisma } from '../database/prisma';
import { getGuildSettings } from '../database/settingsCache';

export async function getOrCreateDefaultPanel(guildId: string) {
  let panel = await prisma.ticketPanel.findFirst({ where: { guildId }, include: { categories: true } });
  if (!panel) {
    panel = await prisma.ticketPanel.create({
      data: {
        guildId,
        name: 'Support Center',
        categories: {
          create: [
            { label: 'General Support', emoji: '❓', order: 0 },
            { label: 'Player Report', emoji: '🚨', order: 1 },
            { label: 'Bug Report', emoji: '🐛', order: 2 },
            { label: 'Purchase Problem', emoji: '💳', order: 3 },
            { label: 'Appeal', emoji: '📝', order: 4 }
          ]
        }
      },
      include: { categories: true }
    });
  }
  return panel;
}

export async function nextTicketNumber(guildId: string): Promise<number> {
  const last = await prisma.ticket.findFirst({ where: { guildId }, orderBy: { number: 'desc' } });
  return (last?.number ?? 1000) + 1;
}

export async function createTicketChannel(
  guild: Guild,
  categoryId: string | null,
  opener: { id: string; username: string },
  formAnswers?: Record<string, string>
) {
  const settings = await getGuildSettings(guild.id);
  const number = await nextTicketNumber(guild.id);

  const category = settings.ticketCategoryId
    ? ((await guild.channels.fetch(settings.ticketCategoryId).catch(() => null)) as CategoryChannel | null)
    : null;

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: opener.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    },
    ...settings.staffRoleIds.map((roleId) => ({
      id: roleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    }))
  ];

  const channel = await guild.channels.create({
    name: `ticket-${number}`,
    type: ChannelType.GuildText,
    parent: category?.id,
    permissionOverwrites: overwrites,
    topic: `Ticket #${number} opened by ${opener.username}`
  });

  const ticket = await prisma.ticket.create({
    data: {
      guildId: guild.id,
      categoryId: categoryId ?? undefined,
      number,
      channelId: channel.id,
      openerId: opener.id,
      formAnswers: formAnswers as never
    }
  });

  return { ticket, channel: channel as TextChannel };
}

export async function buildTranscript(channel: TextChannel): Promise<string> {
  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = [...messages.values()].reverse();
  const lines = sorted.map((m) => {
    const time = m.createdAt.toISOString();
    const content = m.content || (m.embeds.length ? '[embed]' : m.attachments.size ? '[attachment]' : '');
    return `[${time}] ${m.author.tag}: ${content}`;
  });
  return lines.join('\n');
}
