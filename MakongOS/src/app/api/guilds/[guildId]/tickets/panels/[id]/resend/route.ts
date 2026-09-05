import { NextResponse } from 'next/server';
import { authorizeGuildRequest } from '../../../../../../../../lib/apiAuth';
import { prisma } from '../../../../../../../../database/prisma';
import { postPanelMessage } from '../../../../../../../../tickets/panelActions';

export async function POST(_req: Request, { params }: { params: { guildId: string; id: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'administrator');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const panel = await prisma.ticketPanel.findFirst({ where: { id: params.id, guildId: params.guildId } });
  if (!panel) return NextResponse.json({ error: 'Panel not found' }, { status: 404 });

  const result = await postPanelMessage(params.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
