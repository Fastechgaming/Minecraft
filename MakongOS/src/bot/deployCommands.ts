import 'dotenv/config';
import { registerCommandsForGuilds, registerCommandsGlobally } from './registerCommands';
import { createLogger } from '../services/logger';

const log = createLogger('deploy');

/**
 * The bot now syncs guild-scoped commands automatically on every startup
 * and whenever it joins a new guild (see src/bot/client.ts), so running
 * this script by hand is optional. It's still useful for:
 *  - a one-off global rollout (set DISCORD_DEV_GUILD_IDS to empty), or
 *  - force-syncing specific guilds without restarting the bot process.
 */
async function main() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!token || !clientId) {
    throw new Error('DISCORD_TOKEN and DISCORD_CLIENT_ID must be set to deploy commands');
  }

  const devGuildIds = (process.env.DISCORD_DEV_GUILD_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (devGuildIds.length > 0) {
    await registerCommandsForGuilds(devGuildIds);
  } else {
    await registerCommandsGlobally();
    log.info('Tip: the bot also auto-syncs guild-scoped commands (instant) to every server it is already in on startup.');
  }
}

main().catch((err) => {
  log.error('Command deployment failed', err);
  process.exit(1);
});
