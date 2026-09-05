import { ChannelType } from 'discord.js';
import { prisma } from '../../../../../database/prisma';
import { getBotClient } from '../../../../../bot/globalClient';
import { PanelsList } from '../../../../../components/dashboard/forms/PanelsList';

export default async function PanelsPage({ params }: { params: { guildId: string } }) {
  const panels = await prisma.ticketPanel.findMany({
    where: { guildId: params.guildId },
    include: { categories: true },
    orderBy: { lastSeenAt: 'desc' }
  });
  const guild = getBotClient()?.guilds.cache.get(params.guildId);
  const textChannels = guild ? [...guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).values()].map((c) => ({ id: c.id, name: c.name })) : [];

  return <PanelsList guildId={params.guildId} initialPanels={panels} textChannels={textChannels} />;
}
