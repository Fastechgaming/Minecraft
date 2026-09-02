import { prisma } from '../../../../database/prisma';
import { getBotClient } from '../../../../bot/globalClient';
import { ChannelType } from 'discord.js';
import { VoiceHubForm } from '../../../../components/dashboard/forms/VoiceHubForm';

export default async function VoiceHubPage({ params }: { params: { guildId: string } }) {
  const settings = await prisma.guildSettings.upsert({ where: { guildId: params.guildId }, update: {}, create: { guildId: params.guildId } });
  const guild = getBotClient()?.guilds.cache.get(params.guildId);
  const voiceChannels = guild ? [...guild.channels.cache.filter((c) => c.type === ChannelType.GuildVoice).values()].map((c) => ({ id: c.id, name: c.name })) : [];
  const categories = guild ? [...guild.channels.cache.filter((c) => c.type === ChannelType.GuildCategory).values()].map((c) => ({ id: c.id, name: c.name })) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Voice Hub</h1>
        <p className="text-discord-muted">Join-to-create temporary voice channels with an owner control panel.</p>
      </div>
      <VoiceHubForm guildId={params.guildId} initialSettings={settings} voiceChannels={voiceChannels} categories={categories} />
    </div>
  );
}
