import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { authorizeGuildRequest } from '../../../../../../../lib/apiAuth';
import { prisma } from '../../../../../../../database/prisma';
import type { PanelEmbedData, PanelComponentRow, OpenerPermissionOverrides } from '../../../../../../../tickets/panelTypes';

export async function PATCH(req: Request, { params }: { params: { guildId: string; id: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'administrator');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await req.json()) as Partial<{
    content: string | null;
    embeds: PanelEmbedData[];
    components: PanelComponentRow[];
    openerPermissionOverrides: OpenerPermissionOverrides;
  }>;

  const panel = await prisma.ticketPanel.updateMany({
    where: { id: params.id, guildId: params.guildId },
    data: {
      ...(body.content !== undefined && { content: body.content }),
      ...(body.embeds !== undefined && { embeds: body.embeds as unknown as Prisma.InputJsonValue }),
      ...(body.components !== undefined && { components: body.components as unknown as Prisma.InputJsonValue }),
      ...(body.openerPermissionOverrides !== undefined && { openerPermissionOverrides: body.openerPermissionOverrides as unknown as Prisma.InputJsonValue })
    }
  });
  if (panel.count === 0) return NextResponse.json({ error: 'Panel not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { guildId: string; id: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'administrator');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await prisma.$transaction([
    prisma.ticketCategory.deleteMany({ where: { panelId: params.id, guildId: params.guildId } }),
    prisma.ticketPanel.deleteMany({ where: { id: params.id, guildId: params.guildId } })
  ]);
  return NextResponse.json({ ok: true });
}
