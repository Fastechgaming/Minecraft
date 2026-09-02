import { prisma } from '../../../database/prisma';
import { getBotClient } from '../../../bot/globalClient';
import { StatCard } from '../../../components/dashboard/StatCard';

function formatUptime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(' ') || '<1m';
}

export default async function OverviewPage({ params }: { params: { guildId: string } }) {
  const { guildId } = params;
  const client = getBotClient();
  const discordGuild = client?.guilds.cache.get(guildId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [ticketOpen, ticketTotal, aiUsage, commandCount, activeGiveaways, openEscalations, recentLogs, dbOk] = await Promise.all([
    prisma.ticket.count({ where: { guildId, status: { not: 'closed' } } }),
    prisma.ticket.count({ where: { guildId } }),
    prisma.aIUsage.findUnique({ where: { guildId_date: { guildId, date: today } } }),
    prisma.auditLog.count({ where: { guildId, type: 'command' } }),
    prisma.giveaway.count({ where: { guildId, ended: false } }),
    prisma.aIEscalation.count({ where: { guildId, resolved: false } }),
    prisma.auditLog.findMany({ where: { guildId }, orderBy: { createdAt: 'desc' }, take: 8 }),
    prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        <p className="text-discord-muted">Live status for {discordGuild?.name ?? 'this server'}.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Bot Status" value={client?.isReady() ? '🟢 Online' : '🔴 Offline'} />
        <StatCard label="Uptime" value={formatUptime(client?.uptime ?? 0)} />
        <StatCard label="Members" value={discordGuild?.memberCount ?? '—'} />
        <StatCard label="Database" value={dbOk ? '🟢 Connected' : '🔴 Error'} />
        <StatCard label="Tickets" value={`${ticketOpen} open`} hint={`${ticketTotal} total`} />
        <StatCard label="AI Chats Today" value={aiUsage?.chatMessages ?? 0} hint={`${openEscalations} open escalation(s)`} />
        <StatCard label="Active Giveaways" value={activeGiveaways} />
        <StatCard label="Commands Run" value={commandCount} />
      </div>

      <div className="card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-discord-muted">Recent Events</h2>
        {recentLogs.length === 0 ? (
          <p className="text-sm text-discord-muted">No activity yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recentLogs.map((log) => (
              <li key={log.id} className="flex items-center justify-between rounded-lg bg-discord-panel2 px-3 py-2 text-sm">
                <span className="text-white">
                  <span className="pill mr-2 bg-discord-blurple/20 text-discord-blurple">{log.type}</span>
                  {log.summary}
                </span>
                <span className="text-xs text-discord-muted">{log.createdAt.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
