import { REST, Routes } from 'discord.js';
import { modules } from './registry';
import { createLogger } from '../services/logger';

const log = createLogger('commands');

/**
 * Discord rejects the entire registration payload if any two commands share
 * a name ([APPLICATION_COMMANDS_DUPLICATE_NAME]) — that failure is silent
 * from the bot's perspective (registerCommandsForGuild just logs and moves
 * on) and breaks slash commands for every guild at once. Fail loudly and
 * immediately instead, so a colliding command name is caught at boot
 * rather than discovered in production logs.
 */
export function buildCommandsJson() {
  const commands = modules.flatMap((mod) => (mod.commands ?? []).map((c) => ({ mod: mod.name, json: c.data.toJSON() })));

  const seen = new Map<string, string>();
  for (const { mod, json } of commands) {
    const owner = seen.get(json.name);
    if (owner) {
      throw new Error(
        `Duplicate slash command name "/${json.name}" defined in both the "${owner}" and "${mod}" modules. ` +
          'Command names must be unique across all modules — rename one of them.'
      );
    }
    seen.set(json.name, mod);
  }

  return commands.map((c) => c.json);
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
