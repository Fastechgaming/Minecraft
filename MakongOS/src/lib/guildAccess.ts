import { prisma } from '../database/prisma';
import { getBotClient } from '../bot/globalClient';
import { getBotOwnerIds, type DashboardRole } from '../services/permissions';

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;

export interface ManagedGuild {
  id: string;
  name: string;
  icon: string | null;
  botPresent: boolean;
  role: DashboardRole;
}

export async function getManagedGuilds(accessToken: string, userId: string): Promise<ManagedGuild[]> {
  const res = await fetch('https://discord.com/api/users/@me/guilds', {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 30 }
  });
  if (!res.ok) return [];
  const guilds = (await res.json()) as DiscordGuild[];

  const isBotOwner = getBotOwnerIds().includes(userId);
  const botClient = getBotClient();
  const botGuildIds = new Set(botClient ? [...botClient.guilds.cache.keys()] : (await prisma.guild.findMany({ select: { id: true } })).map((g) => g.id));

  const manageable = guilds.filter((g) => {
    const perms = BigInt(g.permissions ?? '0');
    return g.owner || (perms & MANAGE_GUILD) !== 0n || (perms & ADMINISTRATOR) !== 0n;
  });

  const access = await prisma.dashboardAccess.findMany({ where: { userId, guildId: { in: manageable.map((g) => g.id) } } });
  const accessMap = new Map(access.map((a) => [a.guildId, a.role as DashboardRole]));

  return manageable.map((g) => ({
    id: g.id,
    name: g.name,
    icon: g.icon,
    botPresent: botGuildIds.has(g.id),
    role: isBotOwner ? 'owner' : accessMap.get(g.id) ?? (g.owner ? 'owner' : 'administrator')
  }));
}

export async function getGuildRole(accessToken: string, userId: string, guildId: string): Promise<DashboardRole | null> {
  const guilds = await getManagedGuilds(accessToken, userId);
  return guilds.find((g) => g.id === guildId)?.role ?? null;
}
