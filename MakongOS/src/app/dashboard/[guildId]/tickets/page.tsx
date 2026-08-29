import { getOrCreateDefaultPanel } from '../../../../tickets/service';
import { prisma } from '../../../../database/prisma';
import { TicketCategoryManager } from '../../../../components/dashboard/forms/TicketCategoryManager';

export default async function TicketsPage({ params }: { params: { guildId: string } }) {
  const panel = await getOrCreateDefaultPanel(params.guildId);
  const [openCount, totalCount] = await Promise.all([
    prisma.ticket.count({ where: { guildId: params.guildId, status: { not: 'closed' } } }),
    prisma.ticket.count({ where: { guildId: params.guildId } })
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Tickets</h1>
        <p className="text-discord-muted">
          {openCount} open / {totalCount} total. Run <code className="rounded bg-discord-panel2 px-1.5 py-0.5">/ticket-panel</code> in any channel to post
          this panel.
        </p>
      </div>
      <TicketCategoryManager
        guildId={params.guildId}
        panelTitle={panel.title}
        categories={panel.categories.map((c) => ({ id: c.id, label: c.label, emoji: c.emoji, description: c.description }))}
      />
    </div>
  );
}
