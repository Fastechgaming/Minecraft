import { NextResponse } from 'next/server';
import { authorizeGuildRequest } from '../../../../../lib/apiAuth';
import { prisma } from '../../../../../database/prisma';

export async function GET(_req: Request, { params }: { params: { guildId: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'viewer');
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const config = await prisma.welcomeConfig.upsert({ where: { guildId: params.guildId }, create: { guildId: params.guildId }, update: {} });
  return NextResponse.json(config);
}

export async function PATCH(req: Request, { params }: { params: { guildId: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'administrator');
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = (await req.json()) as Record<string, unknown>;
  const { id: _id, guildId: _g, ...rest } = body as { id?: unknown; guildId?: unknown } & Record<string, unknown>;
  const updated = await prisma.welcomeConfig.upsert({
    where: { guildId: params.guildId },
    create: { guildId: params.guildId, ...rest } as never,
    update: rest as never
  });
  return NextResponse.json(updated);
}
