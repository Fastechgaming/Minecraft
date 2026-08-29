import { getGuildSettings } from '../../../../database/settingsCache';
import { getBotClient } from '../../../../bot/globalClient';
import { ChannelType } from 'discord.js';
import { ServerGeneralForm } from '../../../../components/dashboard/forms/ServerGeneralForm';

export default async function ServerGeneralPage({ params }: { params: { guildId: string } }) {
  const settings = await getGuildSettings(params.guildId);
  const client = getBotClient();
  const guild = client?.guilds.cache.get(params.guildId);

  const channels = guild
    ? [...guild.channels.cache.values()]
        .filter((c) => c.type === ChannelType.GuildText)
        .map((c) => ({ id: c.id, name: c.name }))
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];
  const roles = guild
    ? [...guild.roles.cache.values()]
        .filter((r) => r.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .map((r) => ({ id: r.id, name: r.name }))
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">General Settings</h1>
        <p className="text-discord-muted">Prefix, locale, channels, roles, and feature toggles.</p>
      </div>
      <ServerGeneralForm guildId={params.guildId} initial={settings} channels={channels} roles={roles} botOnline={!!guild} />
    </div>
  );
}
