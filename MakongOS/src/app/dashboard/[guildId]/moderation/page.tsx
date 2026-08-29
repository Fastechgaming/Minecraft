import { ChannelType } from 'discord.js';
import { getGuildSettings } from '../../../../database/settingsCache';
import { getBotClient } from '../../../../bot/globalClient';
import { ModerationSettingsForm } from '../../../../components/dashboard/forms/ModerationSettingsForm';

export default async function ModerationPage({ params }: { params: { guildId: string } }) {
  const settings = await getGuildSettings(params.guildId);
  const client = getBotClient();
  const guild = client?.guilds.cache.get(params.guildId);
  const channels = guild
    ? [...guild.channels.cache.values()].filter((c) => c.type === ChannelType.GuildText).map((c) => ({ id: c.id, name: c.name }))
    : [];
  const roles = guild
    ? [...guild.roles.cache.values()].filter((r) => r.id !== guild.id).map((r) => ({ id: r.id, name: r.name }))
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">AutoMod & Anti-Spam</h1>
        <p className="text-discord-muted">Tune the scoring engine that catches flooding, duplicates, mention/link/invite spam.</p>
      </div>
      <ModerationSettingsForm guildId={params.guildId} initial={settings} channels={channels} roles={roles} />
    </div>
  );
}
