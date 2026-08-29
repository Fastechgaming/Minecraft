import { ChannelType } from 'discord.js';
import { getCommandRegistry } from '../../../../bot/globalClient';
import { getBotClient } from '../../../../bot/globalClient';
import { prisma } from '../../../../database/prisma';
import { CommandManagerTable } from '../../../../components/dashboard/forms/CommandManagerTable';

export default async function CommandManagerPage({ params }: { params: { guildId: string } }) {
  const registry = getCommandRegistry();
  const configs = await prisma.commandConfig.findMany({ where: { guildId: params.guildId } });
  const configMap = new Map(configs.map((c) => [c.commandName, c]));

  const client = getBotClient();
  const guild = client?.guilds.cache.get(params.guildId);
  const channels = guild
    ? [...guild.channels.cache.values()].filter((c) => c.type === ChannelType.GuildText).map((c) => ({ id: c.id, name: c.name }))
    : [];
  const roles = guild
    ? [...guild.roles.cache.values()].filter((r) => r.id !== guild.id).map((r) => ({ id: r.id, name: r.name }))
    : [];

  const rows = registry.map((cmd) => {
    const config = configMap.get(cmd.name);
    return {
      name: cmd.name,
      description: cmd.description,
      module: cmd.module,
      enabled: config?.enabled ?? true,
      cooldownSec: config?.cooldownSec ?? cmd.defaultCooldownSec,
      allowedRoleIds: config?.allowedRoleIds ?? [],
      disabledChannelIds: config?.disabledChannelIds ?? []
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Command Manager</h1>
        <p className="text-discord-muted">
          {rows.length > 0 ? `${rows.length} commands registered.` : 'The bot has not registered any commands yet — is it online?'}
        </p>
      </div>
      <CommandManagerTable guildId={params.guildId} rows={rows} channels={channels} roles={roles} />
    </div>
  );
}
