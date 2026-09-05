import { NextResponse } from 'next/server';
import { authorizeGuildRequest } from '../../../../../../../../lib/apiAuth';
import { prisma } from '../../../../../../../../database/prisma';

export async function POST(_req: Request, { params }: { params: { guildId: string; id: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'administrator');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const panel = await prisma.ticketPanel.findFirst({ where: { id: params.id, guildId: params.guildId } });
  if (!panel) return NextResponse.json({ error: 'Panel not found' }, { status: 404 });

  const count = await prisma.ticketCategory.count({ where: { panelId: params.id } });
  const option = await prisma.ticketCategory.create({
    data: { guildId: params.guildId, panelId: params.id, name: `Option ${count + 1}`, emoji: '🎫' }
  });
  return NextResponse.json(option);
}
