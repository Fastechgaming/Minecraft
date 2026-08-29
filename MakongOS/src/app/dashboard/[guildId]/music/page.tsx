import { ChannelType } from 'discord.js';
import { getGuildSettings } from '../../../../database/settingsCache';
import { getBotClient } from '../../../../bot/globalClient';
import { MusicSettingsForm } from '../../../../components/dashboard/forms/MusicSettingsForm';

export default async function MusicPage({ params }: { params: { guildId: string } }) {
  const settings = await getGuildSettings(params.guildId);
  const client = getBotClient();
  const guild = client?.guilds.cache.get(params.guildId);
  const channels = guild
    ? [...guild.channels.cache.values()].filter((c) => c.type === ChannelType.GuildText).map((c) => ({ id: c.id, name: c.name }))
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Music</h1>
        <p className="text-discord-muted">Queue limits, default volume, and which channels allow music commands.</p>
      </div>
      <MusicSettingsForm guildId={params.guildId} initial={settings} channels={channels} />
    </div>
  );
}
