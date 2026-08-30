import { prisma } from '../../../../database/prisma';

export default async function GiveawaysPage({ params }: { params: { guildId: string } }) {
  const [active, ended] = await Promise.all([
    prisma.giveaway.findMany({ where: { guildId: params.guildId, ended: false }, orderBy: { endsAt: 'asc' } }),
    prisma.giveaway.findMany({ where: { guildId: params.guildId, ended: true }, orderBy: { endsAt: 'desc' }, take: 20 })
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Giveaways</h1>
        <p className="text-discord-muted">
          Start one with <code className="rounded bg-discord-panel2 px-1.5 py-0.5">/giveaway start</code>. They end automatically.
        </p>
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-discord-muted">Active</h2>
        {active.length === 0 ? (
          <p className="text-discord-muted">No active giveaways.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {active.map((g) => (
              <li key={g.id} className="flex items-center justify-between rounded-lg bg-discord-panel2 px-3 py-2 text-sm">
                <span className="text-white">
                  🎉 <strong>{g.prize}</strong> — {g.winnerCount} winner{g.winnerCount === 1 ? '' : 's'}
                </span>
                <span className="text-xs text-discord-muted">ends {g.endsAt.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-discord-muted">Recent History</h2>
        {ended.length === 0 ? (
          <p className="text-discord-muted">No completed giveaways yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ended.map((g) => (
              <li key={g.id} className="flex items-center justify-between rounded-lg bg-discord-panel2 px-3 py-2 text-sm">
                <span className="text-white">🎉 {g.prize}</span>
                <span className="text-xs text-discord-muted">
                  {g.winnerIds.length > 0 ? `${g.winnerIds.length} winner(s)` : 'No entries'} · {g.endsAt.toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
