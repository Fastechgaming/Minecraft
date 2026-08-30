import type { GuildMember } from 'discord.js';
import type { GuildSettings } from '@prisma/client';

/** Dashboard role hierarchy, low to high. Never rely on hardcoded user IDs alone. */
export const DASHBOARD_ROLES = ['viewer', 'support', 'dj', 'ai_manager', 'administrator', 'owner'] as const;

export type DashboardRole = (typeof DASHBOARD_ROLES)[number];

export function roleRank(role: string): number {
  const idx = DASHBOARD_ROLES.indexOf(role as DashboardRole);
  return idx === -1 ? 0 : idx;
}

export function hasAtLeastRole(role: string, required: DashboardRole): boolean {
  return roleRank(role) >= roleRank(required);
}

export function getBotOwnerIds(): string[] {
  return (process.env.BOT_OWNER_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

/** In-Discord staff tier checks, driven entirely by dashboard-configured role IDs. */
export function isStaff(member: GuildMember, settings: GuildSettings): boolean {
  return isAdmin(member, settings) || settings.staffRoleIds.some((id) => member.roles.cache.has(id));
}

export function isAdmin(member: GuildMember, settings: GuildSettings): boolean {
  return (
    member.id === member.guild.ownerId ||
    settings.adminRoleIds.some((id) => member.roles.cache.has(id)) ||
    member.permissions.has('Administrator')
  );
}

export function isDJ(member: GuildMember, settings: GuildSettings): boolean {
  return (
    settings.djRoleIds.length === 0 ||
    isStaff(member, settings) ||
    settings.djRoleIds.some((id) => member.roles.cache.has(id))
  );
}
