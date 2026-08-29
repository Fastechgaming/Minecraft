import { prisma } from '../../../../database/prisma';
import { getBotClient, getBotStartedAt } from '../../../../bot/globalClient';
import { getCommandRegistry } from '../../../../bot/globalClient';
import { StatCard } from '../../../../components/dashboard/StatCard';

async function checkDb(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export default async function SystemPage({ params }: { params: { guildId: string } }) {
  const client = getBotClient();
  const startedAt = getBotStartedAt();
  const dbOk = await checkDb();
  const registry = getCommandRegistry();
  const guild = client?.guilds.cache.get(params.guildId);

  const providers = [
    { name: 'Discord Bot Token', configured: !!process.env.DISCORD_TOKEN },
    { name: 'Gemini AI (GEMINI_API_KEY)', configured: !!process.env.GEMINI_API_KEY },
    { name: 'PostgreSQL (DATABASE_URL)', configured: !!process.env.DATABASE_URL },
    { name: 'Discord OAuth (Dashboard Login)', configured: !!process.env.DISCORD_CLIENT_ID && !!process.env.DISCORD_CLIENT_SECRET }
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">System Health</h1>
        <p className="text-discord-muted">Runtime status for the bot, database, and configured providers.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Bot Connection" value={client?.isReady() ? '🟢 Connected' : '🔴 Disconnected'} />
        <StatCard label="This Guild" value={guild ? '🟢 In Guild' : '⚪ Not Joined'} />
        <StatCard label="Database" value={dbOk ? '🟢 Healthy' : '🔴 Error'} />
        <StatCard label="Uptime" value={startedAt ? `${Math.floor((Date.now() - startedAt) / 60000)}m` : '—'} />
        <StatCard label="Commands Registered" value={registry.length} />
        <StatCard label="WS Ping" value={client ? `${client.ws.ping}ms` : '—'} />
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-discord-muted">Providers</h2>
        <ul className="flex flex-col gap-2">
          {providers.map((p) => (
            <li key={p.name} className="flex items-center justify-between rounded-lg bg-discord-panel2 px-3 py-2 text-sm">
              <span className="text-white">{p.name}</span>
              <span className={p.configured ? 'text-discord-green' : 'text-discord-red'}>{p.configured ? '✓ Configured' : '✗ Missing'}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-discord-muted">
          Configure secrets via environment variables (.env). They are never exposed to the dashboard frontend.
        </p>
      </div>
    </div>
  );
}
