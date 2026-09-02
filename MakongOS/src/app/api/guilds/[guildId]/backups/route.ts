import { NextResponse } from 'next/server';
import { authorizeGuildRequest } from '../../../../../lib/apiAuth';
import { getBotClient } from '../../../../../bot/globalClient';
import { createBackup, listBackups } from '../../../../../utility/backup';

export async function GET(_req: Request, { params }: { params: { guildId: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'viewer');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const backups = await listBackups(params.guildId);
  return NextResponse.json(backups);
}

export async function POST(req: Request, { params }: { params: { guildId: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'administrator');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const guild = getBotClient()?.guilds.cache.get(params.guildId);
  if (!guild) return NextResponse.json({ error: 'Bot is not in this server or is offline' }, { status: 400 });

  const body = (await req.json()) as { name: string };
  const backup = await createBackup(guild, body.name || `Backup ${new Date().toLocaleString()}`, auth.userId);
  return NextResponse.json(backup);
}
