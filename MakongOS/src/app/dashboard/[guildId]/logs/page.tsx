import { prisma } from '../../../../database/prisma';

const TYPES = ['moderation', 'ticket', 'modmail', 'command', 'ai', 'error', 'member_join', 'member_leave', 'giveaway', 'economy', 'voice_hub'];

export default async function LogsPage({ params, searchParams }: { params: { guildId: string }; searchParams: { type?: string } }) {
  const type = searchParams.type;
  const logs = await prisma.auditLog.findMany({
    where: { guildId: params.guildId, ...(type ? { type } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 100
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
        <p className="text-discord-muted">The last 100 events across every module.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <a href={`/dashboard/${params.guildId}/logs`} className={`pill border ${!type ? 'border-discord-blurple bg-discord-blurple/20 text-white' : 'border-discord-border text-discord-muted'}`}>
          All
        </a>
        {TYPES.map((t) => (
          <a
            key={t}
            href={`/dashboard/${params.guildId}/logs?type=${t}`}
            className={`pill border ${type === t ? 'border-discord-blurple bg-discord-blurple/20 text-white' : 'border-discord-border text-discord-muted'}`}
          >
            {t}
          </a>
        ))}
      </div>

      <div className="card p-4">
        {logs.length === 0 ? (
          <p className="text-sm text-discord-muted">No events yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {logs.map((log) => (
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
