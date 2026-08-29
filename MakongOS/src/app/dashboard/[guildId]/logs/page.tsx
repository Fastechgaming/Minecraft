import { prisma } from '../../../../database/prisma';
import { LogFilters } from '../../../../components/dashboard/forms/LogFilters';

const TYPES = [
  'moderation', 'ticket', 'command', 'ai', 'error', 'member_join', 'member_leave',
  'role_change', 'channel_change', 'message_delete', 'message_edit', 'anti_spam', 'security'
];

export default async function LogsPage({ params, searchParams }: { params: { guildId: string }; searchParams: Record<string, string | undefined> }) {
  const { type, userId, moderatorId, channelId } = searchParams;

  const logs = await prisma.auditLog.findMany({
    where: {
      guildId: params.guildId,
      ...(type ? { type } : {}),
      ...(userId ? { userId } : {}),
      ...(moderatorId ? { moderatorId } : {}),
      ...(channelId ? { channelId } : {})
    },
    orderBy: { createdAt: 'desc' },
    take: 150
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
        <p className="text-discord-muted">Searchable history across every system: moderation, tickets, commands, AI, and more.</p>
      </div>

      <LogFilters types={TYPES} current={{ type, userId, moderatorId, channelId }} />

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-discord-muted">
            <tr className="border-b border-discord-border">
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-discord-border/50 last:border-0">
                <td className="px-4 py-3">
                  <span className="pill bg-discord-blurple/20 text-discord-blurple">{log.type}</span>
                </td>
                <td className="px-4 py-3 text-white">{log.action}</td>
                <td className="px-4 py-3 font-mono text-xs text-discord-muted">{log.userId ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-discord-muted">{log.channelId ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-discord-muted">{log.createdAt.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <p className="p-6 text-center text-discord-muted">No matching log entries.</p>}
      </div>
    </div>
  );
}
