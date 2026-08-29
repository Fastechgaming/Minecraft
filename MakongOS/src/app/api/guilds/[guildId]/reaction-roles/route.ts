import { NextResponse } from 'next/server';
import { authorizeGuildRequest } from '../../../../../lib/apiAuth';
import { prisma } from '../../../../../database/prisma';

export async function GET(_req: Request, { params }: { params: { guildId: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'viewer');
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const panels = await prisma.reactionRolePanel.findMany({ where: { guildId: params.guildId } });
  return NextResponse.json(panels);
}

export async function POST(req: Request, { params }: { params: { guildId: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'administrator');
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = (await req.json()) as { title: string; style: string; options: { label: string; emoji?: string; roleId: string }[] };
  const panel = await prisma.reactionRolePanel.create({
    data: { guildId: params.guildId, title: body.title, style: body.style, options: body.options as never }
  });
  return NextResponse.json(panel);
}
