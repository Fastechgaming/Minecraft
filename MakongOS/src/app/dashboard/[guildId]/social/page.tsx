import { prisma } from '../../../../database/prisma';
import { getBotClient } from '../../../../bot/globalClient';
import { ChannelType } from 'discord.js';
import { SocialManager } from '../../../../components/dashboard/forms/SocialManager';

export default async function SocialPage({ params }: { params: { guildId: string } }) {
  const alerts = await prisma.socialAlert.findMany({ where: { guildId: params.guildId } });
  const guild = getBotClient()?.guilds.cache.get(params.guildId);
  const textChannels = guild ? [...guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).values()].map((c) => ({ id: c.id, name: c.name })) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Live Alerts</h1>
        <p className="text-discord-muted">Announce when a Twitch stream goes live or a YouTube video is uploaded.</p>
      </div>
      <SocialManager guildId={params.guildId} initialAlerts={alerts} textChannels={textChannels} />
    </div>
  );
}
