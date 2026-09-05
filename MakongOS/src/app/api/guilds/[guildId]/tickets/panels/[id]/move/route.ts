import { NextResponse } from 'next/server';
import { authorizeGuildRequest } from '../../../../../../../../lib/apiAuth';
import { prisma } from '../../../../../../../../database/prisma';
import { postPanelMessage } from '../../../../../../../../tickets/panelActions';

export async function POST(req: Request, { params }: { params: { guildId: string; id: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'administrator');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const panel = await prisma.ticketPanel.findFirst({ where: { id: params.id, guildId: params.guildId } });
  if (!panel) return NextResponse.json({ error: 'Panel not found' }, { status: 404 });

  const body = (await req.json()) as { channelId: string };
  if (!body.channelId) return NextResponse.json({ error: 'channelId is required' }, { status: 400 });

  const result = await postPanelMessage(params.id, body.channelId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
