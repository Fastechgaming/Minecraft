import { NextResponse } from 'next/server';
import { authorizeGuildRequest } from '../../../../../../lib/apiAuth';
import { prisma } from '../../../../../../database/prisma';
import { getOrCreateDefaultPanel } from '../../../../../../tickets/service';

export async function POST(req: Request, { params }: { params: { guildId: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'administrator');
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = (await req.json()) as { label: string; emoji?: string; description?: string };
  const panel = await getOrCreateDefaultPanel(params.guildId);
  const category = await prisma.ticketCategory.create({
    data: { panelId: panel.id, label: body.label, emoji: body.emoji, description: body.description, order: panel.categories.length }
  });
  return NextResponse.json(category);
}
