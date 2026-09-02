import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { modules } from './registry';
import { createLogger } from '../services/logger';

const log = createLogger('commands');

function buildCommandsJson(): unknown[] {
  const seen = new Map<string, string>();
  const commands: unknown[] = [];

  for (const mod of modules) {
    for (const command of mod.commands ?? []) {
      const name = command.data.name;
      const owner = seen.get(name);
      if (owner) {
        throw new Error(
          `Duplicate slash command name "/${name}" defined in both the "${owner}" and "${mod.name}" modules. Command names must be unique across all modules — rename one of them.`
        );
      }
      seen.set(name, mod.name);

      const json = command.data.toJSON() as unknown as Record<string, unknown>;
      if (command.userInstallable) {
        json.integration_types = [0, 1]; // GUILD_INSTALL, USER_INSTALL
        json.contexts = [0, 1, 2]; // GUILD, BOT_DM, PRIVATE_CHANNEL
      }
      commands.push(json);
    }
  }

  return commands;
}

function rest(): REST {
  return new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN ?? '');
}

export async function registerCommandsForGuild(guildId: string): Promise<void> {
  const clientId = process.env.DISCORD_CLIENT_ID ?? '';
  const commands = buildCommandsJson();
  try {
    await rest().put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    log.info(`Synced ${commands.length} commands to guild ${guildId}`);
  } catch (err) {
    log.error(`Failed to sync commands for guild ${guildId}`, err);
  }
}

export async function registerCommandsForGuilds(guildIds: Iterable<string>): Promise<void> {
  const commands = buildCommandsJson();
  const clientId = process.env.DISCORD_CLIENT_ID ?? '';
  for (const guildId of guildIds) {
    try {
      await rest().put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    } catch (err) {
      log.error(`Failed to sync commands for guild ${guildId}`, err);
    }
  }
  log.info(`Synced ${commands.length} commands to ${[...guildIds].length} guild(s)`);
}

export async function registerCommandsGlobally(): Promise<void> {
  const clientId = process.env.DISCORD_CLIENT_ID ?? '';
  const commands = buildCommandsJson();
  await rest().put(Routes.applicationCommands(clientId), { body: commands });
  log.info(`Globally registered ${commands.length} commands`);
}
