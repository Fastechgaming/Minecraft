import { NextResponse } from 'next/server';
import { ChannelType } from 'discord.js';
import { authorizeGuildRequest } from '../../../../../lib/apiAuth';
import { getBotClient } from '../../../../../bot/globalClient';

export async function GET(_req: Request, { params }: { params: { guildId: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'viewer');
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const client = getBotClient();
  const guild = client?.guilds.cache.get(params.guildId);
  if (!guild) return NextResponse.json({ channels: [], roles: [], connected: false });

  const channels = [...guild.channels.cache.values()]
    .filter((c) => c.type === ChannelType.GuildText || c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildCategory)
    .map((c) => ({ id: c.id, name: c.name, type: c.type }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const roles = [...guild.roles.cache.values()]
    .filter((r) => r.id !== guild.id)
    .sort((a, b) => b.position - a.position)
    .map((r) => ({ id: r.id, name: r.name, color: r.hexColor }));

  return NextResponse.json({ channels, roles, connected: true });
}
