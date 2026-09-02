import type { GuildMember } from 'discord.js';
import { PermissionFlagsBits } from 'discord.js';
import type { GuildSettings } from '@prisma/client';

export const DASHBOARD_ROLES = ['viewer', 'support', 'dj', 'moderator', 'ai_manager', 'administrator', 'owner'] as const;
export type DashboardRole = (typeof DASHBOARD_ROLES)[number];

export function hasAtLeastRole(role: DashboardRole, minRole: DashboardRole): boolean {
  return DASHBOARD_ROLES.indexOf(role) >= DASHBOARD_ROLES.indexOf(minRole);
}

export function getBotOwnerIds(): string[] {
  return (process.env.BOT_OWNER_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

export function isBotOwner(userId: string): boolean {
  return getBotOwnerIds().includes(userId);
}

export function isAdmin(member: GuildMember, settings?: Pick<GuildSettings, 'adminRoleIds'> | null): boolean {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (member.guild.ownerId === member.id) return true;
  return settings?.adminRoleIds.some((roleId) => member.roles.cache.has(roleId)) ?? false;
}

export function isStaff(
  member: GuildMember,
  settings?: Pick<GuildSettings, 'adminRoleIds' | 'staffRoleIds'> | null
): boolean {
  if (isAdmin(member, settings)) return true;
  return settings?.staffRoleIds.some((roleId) => member.roles.cache.has(roleId)) ?? false;
}

export function isDj(member: GuildMember, settings?: Pick<GuildSettings, 'musicDjRoleIds' | 'adminRoleIds'> | null): boolean {
  if (isAdmin(member, settings)) return true;
  if (!settings?.musicDjRoleIds.length) return true; // no DJ role configured = everyone is a DJ
  return settings.musicDjRoleIds.some((roleId) => member.roles.cache.has(roleId));
}
