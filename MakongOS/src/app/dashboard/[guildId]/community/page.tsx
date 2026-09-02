import { prisma } from '../../../../database/prisma';
import { getBotClient } from '../../../../bot/globalClient';
import { ChannelType } from 'discord.js';
import { CommunityForm } from '../../../../components/dashboard/forms/CommunityForm';

export default async function CommunityPage({ params }: { params: { guildId: string } }) {
  const settings = await prisma.guildSettings.upsert({ where: { guildId: params.guildId }, update: {}, create: { guildId: params.guildId } });
  const guild = getBotClient()?.guilds.cache.get(params.guildId);
  const roles = guild ? [...guild.roles.cache.filter((r) => r.id !== guild.id).values()].map((r) => ({ id: r.id, name: r.name })) : [];
  const textChannels = guild ? [...guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).values()].map((c) => ({ id: c.id, name: c.name })) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Welcome & Leave</h1>
        <p className="text-discord-muted">Greeting messages and automatic roles for new members.</p>
      </div>
      <CommunityForm guildId={params.guildId} initialSettings={settings} roles={roles} textChannels={textChannels} />
    </div>
  );
}
