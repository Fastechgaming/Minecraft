import { prisma } from '../../../../database/prisma';

export default async function GiveawaysPage({ params }: { params: { guildId: string } }) {
  const giveaways = await prisma.giveaway.findMany({ where: { guildId: params.guildId }, orderBy: { createdAt: 'desc' }, take: 30 });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Giveaways</h1>
        <p className="text-discord-muted">Start, end, and reroll giveaways with `/giveaway` in Discord. History is shown below.</p>
      </div>
      <div className="flex flex-col gap-2">
        {giveaways.length === 0 && <p className="text-sm text-discord-muted">No giveaways yet.</p>}
        {giveaways.map((g) => (
          <div key={g.id} className="card flex items-center justify-between p-4">
            <div>
              <div className="font-medium text-white">{g.prize}</div>
              <div className="text-xs text-discord-muted">{g.entrantIds.length} entrant(s) · {g.winnerCount} winner(s)</div>
            </div>
            <span className={`pill ${g.ended ? 'bg-discord-panel2 text-discord-muted' : 'bg-green-500/20 text-green-400'}`}>{g.ended ? 'Ended' : 'Active'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
