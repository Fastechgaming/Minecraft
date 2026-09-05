import { notFound } from 'next/navigation';
import { ChannelType } from 'discord.js';
import { prisma } from '../../../../../../../../database/prisma';
import { getBotClient } from '../../../../../../../../bot/globalClient';
import { TicketOptionEditor } from '../../../../../../../../components/dashboard/forms/TicketOptionEditor';

export default async function TicketOptionPage({ params }: { params: { guildId: string; id: string; optionId: string } }) {
  const option = await prisma.ticketCategory.findFirst({ where: { id: params.optionId, guildId: params.guildId, panelId: params.id } });
  if (!option) notFound();

  const guild = getBotClient()?.guilds.cache.get(params.guildId);
  const roles = guild ? [...guild.roles.cache.filter((r) => r.id !== guild.id).values()].map((r) => ({ id: r.id, name: r.name })) : [];
  const discordCategories = guild ? [...guild.channels.cache.filter((c) => c.type === ChannelType.GuildCategory).values()].map((c) => ({ id: c.id, name: c.name })) : [];

  return <TicketOptionEditor guildId={params.guildId} panelId={params.id} option={option} roles={roles} discordCategories={discordCategories} />;
}
