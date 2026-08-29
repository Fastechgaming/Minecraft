import { ChannelType } from 'discord.js';
import { prisma } from '../../../../../database/prisma';
import { getBotClient } from '../../../../../bot/globalClient';
import { MinecraftServerManager } from '../../../../../components/dashboard/forms/MinecraftServerManager';

export default async function MinecraftPage({ params }: { params: { guildId: string } }) {
  const servers = await prisma.minecraftServer.findMany({ where: { guildId: params.guildId } });
  const client = getBotClient();
  const guild = client?.guilds.cache.get(params.guildId);
  const channels = guild
    ? [...guild.channels.cache.values()].filter((c) => c.type === ChannelType.GuildText).map((c) => ({ id: c.id, name: c.name }))
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Minecraft Integration</h1>
        <p className="text-discord-muted">Connect Java or Bedrock servers for live status panels and player lookups.</p>
      </div>
      <MinecraftServerManager guildId={params.guildId} channels={channels} initial={servers} />
    </div>
  );
}
