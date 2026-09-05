import Link from 'next/link';
import { prisma } from '../../../../database/prisma';
import { getBotClient } from '../../../../bot/globalClient';
import { ChannelType } from 'discord.js';
import { TicketsForm } from '../../../../components/dashboard/forms/TicketsForm';

export default async function TicketsPage({ params }: { params: { guildId: string } }) {
  const settings = await prisma.guildSettings.upsert({ where: { guildId: params.guildId }, update: {}, create: { guildId: params.guildId } });
  const guild = getBotClient()?.guilds.cache.get(params.guildId);
  const textChannels = guild ? [...guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).values()].map((c) => ({ id: c.id, name: c.name })) : [];
  const categories = guild ? [...guild.channels.cache.filter((c) => c.type === ChannelType.GuildCategory).values()].map((c) => ({ id: c.id, name: c.name })) : [];
  const roles = guild ? [...guild.roles.cache.filter((r) => r.id !== guild.id).values()].map((r) => ({ id: r.id, name: r.name })) : [];
  const panelCount = await prisma.ticketPanel.count({ where: { guildId: params.guildId } });
  const openTickets = await prisma.ticket.count({ where: { guildId: params.guildId, status: { not: 'closed' } } });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tickets & Modmail</h1>
          <p className="text-discord-muted">{openTickets} ticket(s) currently open across {panelCount} panel(s).</p>
        </div>
        <Link href={`/dashboard/${params.guildId}/tickets/panels`} className="btn-primary">
          Manage Panels
        </Link>
      </div>
      <TicketsForm guildId={params.guildId} initialSettings={settings} textChannels={textChannels} roles={roles} categories={categories} />
    </div>
  );
}
