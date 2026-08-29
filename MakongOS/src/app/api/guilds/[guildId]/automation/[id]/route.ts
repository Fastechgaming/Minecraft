import { NextResponse } from 'next/server';
import { authorizeGuildRequest } from '../../../../../../lib/apiAuth';
import { prisma } from '../../../../../../database/prisma';

export async function PATCH(req: Request, { params }: { params: { guildId: string; id: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'administrator');
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = (await req.json()) as { enabled?: boolean; name?: string; trigger?: string; conditions?: unknown; actions?: unknown };
  const rule = await prisma.automationRule.update({
    where: { id: params.id },
    data: {
      enabled: body.enabled,
      name: body.name,
      trigger: body.trigger,
      conditions: body.conditions as never,
      actions: body.actions as never
    }
  });
  return NextResponse.json(rule);
}

export async function DELETE(_req: Request, { params }: { params: { guildId: string; id: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'administrator');
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await prisma.automationRule.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
