import { NextResponse } from 'next/server';
import { authorizeGuildRequest } from '../../../../../../lib/apiAuth';
import { prisma } from '../../../../../../database/prisma';

export async function GET(_req: Request, { params }: { params: { guildId: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'viewer');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const panels = await prisma.ticketPanel.findMany({
    where: { guildId: params.guildId },
    include: { categories: true },
    orderBy: { lastSeenAt: 'desc' }
  });
  return NextResponse.json(panels);
}

export async function POST(req: Request, { params }: { params: { guildId: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'administrator');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await req.json()) as { channelId: string };
  if (!body.channelId) return NextResponse.json({ error: 'channelId is required' }, { status: 400 });

  const panel = await prisma.ticketPanel.create({
    data: {
      guildId: params.guildId,
      channelId: body.channelId,
      embeds: [{ title: 'Support', description: 'Select an option below to open a ticket.', color: 0x22c55e }]
    }
  });
  return NextResponse.json(panel);
}
