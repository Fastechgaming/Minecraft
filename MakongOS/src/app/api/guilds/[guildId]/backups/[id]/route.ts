import { NextResponse } from 'next/server';
import { authorizeGuildRequest } from '../../../../../../lib/apiAuth';
import { getBotClient } from '../../../../../../bot/globalClient';
import { prisma } from '../../../../../../database/prisma';
import { restoreBackup } from '../../../../../../utility/backup';

export async function POST(req: Request, { params }: { params: { guildId: string; id: string } }) {
  // Restore is triggered with POST + {action: 'restore'} to keep this a single-purpose route per backup.
  const auth = await authorizeGuildRequest(params.guildId, 'administrator');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const guild = getBotClient()?.guilds.cache.get(params.guildId);
  if (!guild) return NextResponse.json({ error: 'Bot is not in this server or is offline' }, { status: 400 });

  try {
    const result = await restoreBackup(guild, params.id);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { guildId: string; id: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'administrator');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await prisma.serverBackup.deleteMany({ where: { id: params.id, guildId: params.guildId } });
  return NextResponse.json({ ok: true });
}
