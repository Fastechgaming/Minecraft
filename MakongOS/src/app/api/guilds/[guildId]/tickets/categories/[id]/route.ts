import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { authorizeGuildRequest } from '../../../../../../../lib/apiAuth';
import { prisma } from '../../../../../../../database/prisma';
import type { TicketQuestion, OpenerPermissionOverrides, PanelComponentRow } from '../../../../../../../tickets/panelTypes';
import { parsePanelComponents } from '../../../../../../../tickets/panelTypes';

export async function PATCH(req: Request, { params }: { params: { guildId: string; id: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'administrator');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await req.json()) as Partial<{
    name: string;
    emoji: string;
    description: string;
    formFields: TicketQuestion[];
    requiredRoleIds: string[];
    blockedRoleIds: string[];
    customEmbedContent: string | null;
    customTicketMessage: string | null;
    staffRoleIds: string[];
    categoryChannelId: string | null;
    overflowCategoryIds: string[];
    nameFormat: string | null;
    useTicketRolesAsPing: boolean;
    customPingRoleIds: string[];
    openerPermissionMode: 'panelDefault' | 'custom';
    openerPermissionOverrides: OpenerPermissionOverrides;
  }>;

  const { formFields, openerPermissionOverrides, ...rest } = body;
  const result = await prisma.ticketCategory.updateMany({
    where: { id: params.id, guildId: params.guildId },
    data: {
      ...rest,
      ...(formFields !== undefined && { formFields: formFields as unknown as Prisma.InputJsonValue }),
      ...(openerPermissionOverrides !== undefined && { openerPermissionOverrides: openerPermissionOverrides as unknown as Prisma.InputJsonValue })
    }
  });
  if (result.count === 0) return NextResponse.json({ error: 'Ticket option not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { guildId: string; id: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'administrator');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const category = await prisma.ticketCategory.findFirst({ where: { id: params.id, guildId: params.guildId } });
  if (!category) return NextResponse.json({ error: 'Ticket option not found' }, { status: 404 });

  if (category.panelId) {
    const panel = await prisma.ticketPanel.findUnique({ where: { id: category.panelId } });
    if (panel) {
      const rows: PanelComponentRow[] = parsePanelComponents(panel.components).map((row) => ({ ...row, optionIds: row.optionIds.filter((id) => id !== params.id) }));
      await prisma.ticketPanel.update({ where: { id: panel.id }, data: { components: rows as unknown as Prisma.InputJsonValue } });
    }
  }

  await prisma.ticketCategory.deleteMany({ where: { id: params.id, guildId: params.guildId } });
  return NextResponse.json({ ok: true });
}
