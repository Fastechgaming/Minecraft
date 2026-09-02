import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { isBotOwner } from '../../../../services/permissions';
import { getBotClient } from '../../../../bot/globalClient';
import { prisma } from '../../../../database/prisma';
import { StatCard } from '../../../../components/dashboard/StatCard';
import { VoucherManager } from '../../../../components/dashboard/forms/VoucherManager';

function formatUptime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(' ') || '<1m';
}

export default async function AdminPage({ params }: { params: { guildId: string } }) {
  const session = await getServerSession(authOptions);
  const owner = session?.userId ? isBotOwner(session.userId) : false;

  if (!owner) {
    return (
      <div className="card p-6">
        <h1 className="text-xl font-bold text-white">Bot Owner Only</h1>
        <p className="mt-2 text-discord-muted">System stats and premium vouchers are only visible to the bot's configured owners.</p>
      </div>
    );
  }

  const client = getBotClient();
  const errorLogs = await prisma.auditLog.findMany({ where: { guildId: params.guildId, type: 'error' }, orderBy: { createdAt: 'desc' }, take: 20 });
  const vouchers = await prisma.premiumVoucher.findMany({ orderBy: { createdAt: 'desc' } });
  const dbOk = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">System & Vouchers</h1>
        <p className="text-discord-muted">Bot-owner-only system health, error logs, server list, and premium voucher codes.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Bot Status" value={client?.isReady() ? '🟢 Online' : '🔴 Offline'} />
        <StatCard label="Uptime" value={formatUptime(client?.uptime ?? 0)} />
        <StatCard label="Database" value={dbOk ? '🟢 Connected' : '🔴 Error'} />
        <StatCard label="Servers" value={client?.guilds.cache.size ?? 0} />
      </div>

      <div className="card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-discord-muted">Servers</h2>
        <div className="flex flex-col gap-2">
          {client?.guilds.cache.map((g) => (
            <div key={g.id} className="flex items-center justify-between rounded-lg bg-discord-panel2 px-3 py-2 text-sm text-white">
              <span>{g.name}</span>
              <span className="text-discord-muted">{g.memberCount} members</span>
            </div>
          )) ?? <p className="text-sm text-discord-muted">Bot is offline.</p>}
        </div>
      </div>

      <div className="card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-discord-muted">Recent Errors (this server)</h2>
        {errorLogs.length === 0 ? (
          <p className="text-sm text-discord-muted">No errors logged.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {errorLogs.map((log) => (
              <li key={log.id} className="rounded-lg bg-discord-panel2 px-3 py-2 text-sm text-red-400">
                {log.summary} <span className="text-xs text-discord-muted">— {log.createdAt.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <VoucherManager initialVouchers={vouchers} />
    </div>
  );
}
