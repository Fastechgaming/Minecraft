import { prisma } from '../../../../database/prisma';
import { getBotClient } from '../../../../bot/globalClient';
import { ChannelType } from 'discord.js';
import { TicketsForm } from '../../../../components/dashboard/forms/TicketsForm';
import { TicketCategoryList } from '../../../../components/dashboard/forms/TicketCategoryList';

export default async function TicketsPage({ params }: { params: { guildId: string } }) {
  const settings = await prisma.guildSettings.upsert({ where: { guildId: params.guildId }, update: {}, create: { guildId: params.guildId } });
  const guild = getBotClient()?.guilds.cache.get(params.guildId);
  const textChannels = guild ? [...guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).values()].map((c) => ({ id: c.id, name: c.name })) : [];
  const categories = await prisma.ticketCategory.findMany({ where: { guildId: params.guildId } });
  const openTickets = await prisma.ticket.count({ where: { guildId: params.guildId, status: { not: 'closed' } } });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Tickets & Modmail</h1>
        <p className="text-discord-muted">{openTickets} ticket(s) currently open. Panels and categories are created with `/ticketcat` and `/ticket-panel`.</p>
      </div>
      <TicketsForm guildId={params.guildId} initialSettings={settings} textChannels={textChannels} />
      <TicketCategoryList guildId={params.guildId} initialCategories={categories} />
    </div>
  );
}
