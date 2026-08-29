import { REST, Routes } from 'discord.js';
import { modules } from './registry';
import { createLogger } from '../services/logger';

const log = createLogger('commands');

export function buildCommandsJson() {
  return modules.flatMap((mod) => (mod.commands ?? []).map((c) => c.data.toJSON()));
}

function getRest(): REST | null {
  const token = process.env.DISCORD_TOKEN;
  if (!token) return null;
  return new REST({ version: '10' }).setToken(token);
}

/**
 * Registers every slash command directly to one guild. Guild-scoped
 * commands propagate near-instantly (global commands can take up to an
 * hour), so this is what keeps commands "just working" on every startup
 * and on every guild join — no manual `npm run deploy:commands` step.
 */
export async function registerCommandsForGuild(guildId: string): Promise<void> {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const rest = getRest();
  if (!rest || !clientId) return;

  try {
    const body = buildCommandsJson();
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
    log.info(`Synced ${body.length} slash commands to guild ${guildId}`);
  } catch (err) {
    log.error(`Failed to sync commands to guild ${guildId}`, err);
  }
}

export async function registerCommandsForGuilds(guildIds: Iterable<string>): Promise<void> {
  for (const guildId of guildIds) {
    await registerCommandsForGuild(guildId);
  }
}

/** Global registration — only useful if you deliberately want the ~1h propagation window instead of instant per-guild sync. */
export async function registerCommandsGlobally(): Promise<void> {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const rest = getRest();
  if (!rest || !clientId) return;

  const body = buildCommandsJson();
  await rest.put(Routes.applicationCommands(clientId), { body });
  log.info(`Registered ${body.length} global commands (may take up to 1 hour to propagate)`);
}
