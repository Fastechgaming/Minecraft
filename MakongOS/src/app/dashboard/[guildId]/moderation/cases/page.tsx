import { prisma } from '../../../../../database/prisma';

const ACTION_COLORS: Record<string, string> = {
  warn: 'bg-discord-yellow/20 text-discord-yellow',
  timeout: 'bg-discord-yellow/20 text-discord-yellow',
  kick: 'bg-discord-red/20 text-discord-red',
  ban: 'bg-discord-red/20 text-discord-red',
  unban: 'bg-discord-green/20 text-discord-green'
};

export default async function ModerationCasesPage({ params }: { params: { guildId: string } }) {
  const cases = await prisma.moderationCase.findMany({ where: { guildId: params.guildId }, orderBy: { createdAt: 'desc' }, take: 100 });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Moderation Cases</h1>
        <p className="text-discord-muted">Full history of every warn, timeout, kick, ban and channel action.</p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-discord-muted">
            <tr className="border-b border-discord-border">
              <th className="px-4 py-3">Case</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Moderator</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id} className="border-b border-discord-border/50 last:border-0">
                <td className="px-4 py-3 text-discord-muted">#{c.id}</td>
                <td className="px-4 py-3">
                  <span className={`pill ${ACTION_COLORS[c.action] ?? 'bg-discord-panel2 text-discord-muted'}`}>{c.action}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-white">{c.targetId}</td>
                <td className="px-4 py-3 font-mono text-xs text-white">{c.moderatorId}</td>
                <td className="px-4 py-3 text-discord-muted">{c.reason ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-discord-muted">{c.createdAt.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {cases.length === 0 && <p className="p-6 text-center text-discord-muted">No moderation actions recorded yet.</p>}
      </div>
    </div>
  );
}
