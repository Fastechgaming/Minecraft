import type { Guild, TextChannel, User } from 'discord.js';
import { ChannelType, PermissionFlagsBits } from 'discord.js';
import type { TicketCategory, TicketPanel } from '@prisma/client';
import { prisma } from '../database/prisma';
import { getGuildSettings } from '../database/settingsCache';
import { OPENER_PERMISSION_KEYS, formatTicketChannelName, parseOpenerOverrides } from './panelTypes';

export async function nextTicketNumber(guildId: string): Promise<number> {
  const last = await prisma.ticket.findFirst({ where: { guildId }, orderBy: { number: 'desc' } });
  return (last?.number ?? 0) + 1;
}

export async function countOpenTicketsForUser(guildId: string, userId: string): Promise<number> {
  return prisma.ticket.count({ where: { guildId, openerId: userId, status: { not: 'closed' } } });
}

/** Whether the member is allowed to use this ticket option, per its own + server-wide required/blocked roles. */
export function canUseTicketOption(memberRoleIds: string[], category: TicketCategory, serverBlockedRoleIds: string[]): boolean {
  if (category.blockedRoleIds.some((r) => memberRoleIds.includes(r))) return false;
  if (serverBlockedRoleIds.some((r) => memberRoleIds.includes(r))) return false;
  if (category.requiredRoleIds.length > 0 && !category.requiredRoleIds.some((r) => memberRoleIds.includes(r))) return false;
  return true;
}

const PERMISSION_FLAG_BY_KEY = {
  addReactions: PermissionFlagsBits.AddReactions,
  attachFiles: PermissionFlagsBits.AttachFiles,
  embedLinks: PermissionFlagsBits.EmbedLinks,
  sendVoiceMessages: PermissionFlagsBits.SendVoiceMessages,
  useExternalEmojis: PermissionFlagsBits.UseExternalEmojis
} as const;

function resolveOpenerAllowedPermissions(panel: TicketPanel | null, category: TicketCategory): bigint[] {
  const always = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles];
  const overrides =
    category.openerPermissionMode === 'custom' ? parseOpenerOverrides(category.openerPermissionOverrides) : parseOpenerOverrides(panel?.openerPermissionOverrides);

  const extra = OPENER_PERMISSION_KEYS.filter((key) => overrides[key] !== false).map((key) => PERMISSION_FLAG_BY_KEY[key]);
  return [...new Set([...always, ...extra])];
}

/** Finds a category (by primary + overflow list, then the server-wide overflow pool) that still has room for another channel. */
async function pickTicketParentCategory(guild: Guild, category: TicketCategory, serverOverflowIds: string[]): Promise<string | undefined> {
  const candidates = [category.categoryChannelId, ...category.overflowCategoryIds, ...serverOverflowIds].filter((id): id is string => !!id);
  for (const id of candidates) {
    const parent = await guild.channels.fetch(id).catch(() => null);
    if (parent?.type === ChannelType.GuildCategory && parent.children.cache.size < 50) return id;
  }
  return candidates[0]; // all full (or none configured) — let Discord's own channel-create error surface rather than silently dropping the parent
}

export interface CreateTicketOptions {
  categoryId: string | null;
  opener: User;
  formResponses?: Record<string, string>;
}

export async function createTicketChannel(guild: Guild, options: CreateTicketOptions) {
  const category = options.categoryId ? await prisma.ticketCategory.findUnique({ where: { id: options.categoryId } }) : null;
  const panel = category?.panelId ? await prisma.ticketPanel.findUnique({ where: { id: category.panelId } }) : null;
  const settings = await getGuildSettings(guild.id);
  const number = await nextTicketNumber(guild.id);

  const name = category
    ? formatTicketChannelName(category.nameFormat, { number, username: options.opener.username })
    : `ticket-${number}`;
  const parentId = category ? await pickTicketParentCategory(guild, category, settings.ticketOverflowCategoryIds) : undefined;
  const staffRoleIds = [...new Set([...settings.staffRoleIds, ...(category?.staffRoleIds ?? [])])];
  const allowedPerms = category ? resolveOpenerAllowedPermissions(panel, category) : [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory];

  const channel = await guild.channels.create({
    name: name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 90) || `ticket-${number}`,
    type: ChannelType.GuildText,
    parent: parentId,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: options.opener.id, allow: allowedPerms },
      { id: guild.client.user!.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
      ...staffRoleIds.map((roleId) => ({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }))
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

  return { ticket, channel: channel as TextChannel, category, staffRoleIds };
}
