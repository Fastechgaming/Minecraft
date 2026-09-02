import type { Guild, TextChannel, User } from 'discord.js';
import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { prisma } from '../database/prisma';

export async function nextTicketNumber(guildId: string): Promise<number> {
  const last = await prisma.ticket.findFirst({ where: { guildId }, orderBy: { number: 'desc' } });
  return (last?.number ?? 0) + 1;
}

export async function countOpenTicketsForUser(guildId: string, userId: string): Promise<number> {
  return prisma.ticket.count({ where: { guildId, openerId: userId, status: { not: 'closed' } } });
}

export interface CreateTicketOptions {
  categoryId: string | null;
  opener: User;
  formResponses?: Record<string, string>;
}

export async function createTicketChannel(guild: Guild, options: CreateTicketOptions) {
  const category = options.categoryId ? await prisma.ticketCategory.findUnique({ where: { id: options.categoryId } }) : null;
  const number = await nextTicketNumber(guild.id);

  const channel = await guild.channels.create({
    name: `ticket-${number}`,
    type: ChannelType.GuildText,
    parent: category?.categoryChannelId ?? undefined,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: options.opener.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
      { id: guild.client.user!.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
      ...(category?.staffRoleIds.map((roleId) => ({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] })) ?? [])
    ]
  });

  const ticket = await prisma.ticket.create({
    data: {
      guildId: guild.id,
      categoryId: options.categoryId,
      number,
      channelId: channel.id,
      openerId: options.opener.id,
      openerTag: options.opener.tag,
      formResponses: options.formResponses ?? {}
    }
  });

  return { ticket, channel: channel as TextChannel };
}
