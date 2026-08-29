import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { modules } from './registry';
import { createLogger } from '../services/logger';

const log = createLogger('deploy');

async function main() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!token || !clientId) {
    throw new Error('DISCORD_TOKEN and DISCORD_CLIENT_ID must be set to deploy commands');
  }

  const body = modules.flatMap((mod) => (mod.commands ?? []).map((c) => c.data.toJSON()));
  const rest = new REST({ version: '10' }).setToken(token);

  const devGuildIds = (process.env.DISCORD_DEV_GUILD_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (devGuildIds.length > 0) {
    for (const guildId of devGuildIds) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
      log.info(`Registered ${body.length} commands to guild ${guildId}`);
    }
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body });
    log.info(`Registered ${body.length} global commands (may take up to 1 hour to propagate)`);
  }
}

main().catch((err) => {
  log.error('Command deployment failed', err);
  process.exit(1);
});
