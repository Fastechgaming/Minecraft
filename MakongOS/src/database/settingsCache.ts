import type { GuildSettings } from '@prisma/client';
import { prisma } from './prisma';

/**
 * In-process cache for guild settings, shared by the bot and the dashboard
 * API since both run inside the same Node process. Dashboard writes call
 * `invalidateGuildSettings` immediately after saving, so the bot picks up
 * config changes on the very next message/interaction — no restart, no
 * separate pub/sub transport needed.
 */
const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  value: GuildSettings;
  expiresAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __makongosSettingsCache: Map<string, CacheEntry> | undefined;
}

// The Next.js dashboard (API routes) and the custom bot server can end up as
// two separately-bundled copies of this module. Both must invalidate/read
// the *same* cache for dashboard changes to reach the bot instantly, so the
// Map lives on `global` rather than as a module-local variable.
const cache: Map<string, CacheEntry> = global.__makongosSettingsCache ?? new Map();
global.__makongosSettingsCache = cache;

export async function getGuildSettings(guildId: string): Promise<GuildSettings> {
  const cached = cache.get(guildId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  let settings = await prisma.guildSettings.findUnique({ where: { guildId } });
  if (!settings) {
    settings = await prisma.guildSettings.create({ data: { guildId } });
  }

  cache.set(guildId, { value: settings, expiresAt: Date.now() + CACHE_TTL_MS });
  return settings;
}

export function invalidateGuildSettings(guildId: string): void {
  cache.delete(guildId);
}

export function invalidateAllGuildSettings(): void {
  cache.clear();
}

export async function ensureGuild(guild: { id: string; name: string; icon?: string | null; ownerId: string }) {
  await prisma.guild.upsert({
    where: { id: guild.id },
    create: {
      id: guild.id,
      name: guild.name,
      icon: guild.icon ?? null,
      ownerId: guild.ownerId,
      settings: { create: {} }
    },
    update: {
      name: guild.name,
      icon: guild.icon ?? null,
      ownerId: guild.ownerId
    }
  });
}
