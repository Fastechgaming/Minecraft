import type { GuildSettings } from '@prisma/client';
import { prisma } from './prisma';

declare global {
  // eslint-disable-next-line no-var
  var __makongosSettingsCache: Map<string, { value: GuildSettings; expiresAt: number }> | undefined;
}

const CACHE_TTL_MS = 30_000;

const cache: Map<string, { value: GuildSettings; expiresAt: number }> =
  global.__makongosSettingsCache ?? new Map();
global.__makongosSettingsCache = cache;

async function createDefaultSettings(guildId: string): Promise<GuildSettings> {
  return prisma.guildSettings.upsert({
    where: { guildId },
    update: {},
    create: { guildId }
  });
}

export async function getGuildSettings(guildId: string): Promise<GuildSettings> {
  const cached = cache.get(guildId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let settings = await prisma.guildSettings.findUnique({ where: { guildId } });
  if (!settings) settings = await createDefaultSettings(guildId);

  cache.set(guildId, { value: settings, expiresAt: Date.now() + CACHE_TTL_MS });
  return settings;
}

/** Call after any dashboard or bot write to GuildSettings so the next read is fresh. */
export function invalidateGuildSettings(guildId: string): void {
  cache.delete(guildId);
}
