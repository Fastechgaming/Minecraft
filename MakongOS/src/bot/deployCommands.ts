import 'dotenv/config';
import { registerCommandsForGuilds, registerCommandsGlobally } from './registerCommands';

async function main(): Promise<void> {
  const guildIds = (process.env.DISCORD_DEV_GUILD_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (guildIds.length > 0) {
    await registerCommandsForGuilds(guildIds);
  } else {
    await registerCommandsGlobally();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Command deploy failed', err);
  process.exit(1);
});
