import { NextResponse } from 'next/server';
import { authorizeGuildRequest } from '../../../../../lib/apiAuth';
import { prisma } from '../../../../../database/prisma';

export async function GET(_req: Request, { params }: { params: { guildId: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'viewer');
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const rules = await prisma.automationRule.findMany({ where: { guildId: params.guildId }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json(rules);
}

export async function POST(req: Request, { params }: { params: { guildId: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'administrator');
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = (await req.json()) as { name: string; trigger: string; conditions?: unknown; actions: unknown };
  const rule = await prisma.automationRule.create({
    data: { guildId: params.guildId, name: body.name, trigger: body.trigger, conditions: body.conditions as never, actions: body.actions as never }
  });
  return NextResponse.json(rule);
}
