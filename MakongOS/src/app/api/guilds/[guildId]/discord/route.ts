import { NextResponse } from 'next/server';
import { ChannelType } from 'discord.js';
import { authorizeGuildRequest } from '../../../../../lib/apiAuth';
import { getBotClient } from '../../../../../bot/globalClient';

export async function GET(_req: Request, { params }: { params: { guildId: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'viewer');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = getBotClient();
  const guild = client?.guilds.cache.get(params.guildId);
  if (!guild) return NextResponse.json({ roles: [], textChannels: [], voiceChannels: [], categories: [] });

  const roles = guild.roles.cache.filter((r) => r.id !== guild.id).map((r) => ({ id: r.id, name: r.name })).sort((a, b) => a.name.localeCompare(b.name));
  const textChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).map((c) => ({ id: c.id, name: c.name }));
  const voiceChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildVoice).map((c) => ({ id: c.id, name: c.name }));
  const categories = guild.channels.cache.filter((c) => c.type === ChannelType.GuildCategory).map((c) => ({ id: c.id, name: c.name }));

  return NextResponse.json({ roles, textChannels, voiceChannels, categories });
}
