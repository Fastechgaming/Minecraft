import type { Guild, GuildMember, User } from 'discord.js';

interface PlaceholderContext {
  member?: GuildMember | null;
  user?: User | null;
  guild?: Guild | null;
  minecraftPlayer?: string;
  minecraftOnline?: number;
  ticketId?: string | number;
}

/** Central placeholder resolver used by welcome/leave/announcements/embed builder. */
export function applyPlaceholders(template: string, ctx: PlaceholderContext): string {
  const user = ctx.user ?? ctx.member?.user;
  return template
    .replace(/\{user\}/g, user ? `<@${user.id}>` : '')
    .replace(/\{username\}/g, user?.username ?? '')
    .replace(/\{server\}/g, ctx.guild?.name ?? '')
    .replace(/\{member_count\}/g, ctx.guild ? String(ctx.guild.memberCount) : '')
    .replace(/\{channel\}/g, '')
    .replace(/\{ticket_id\}/g, ctx.ticketId !== undefined ? String(ctx.ticketId) : '')
    .replace(/\{minecraft_player\}/g, ctx.minecraftPlayer ?? '')
    .replace(/\{minecraft_online\}/g, ctx.minecraftOnline !== undefined ? String(ctx.minecraftOnline) : '');
}
