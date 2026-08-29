import { NextResponse } from 'next/server';
import { authorizeGuildRequest } from '../../../../../lib/apiAuth';
import { prisma } from '../../../../../database/prisma';

export async function GET(_req: Request, { params }: { params: { guildId: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'viewer');
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const servers = await prisma.minecraftServer.findMany({ where: { guildId: params.guildId } });
  return NextResponse.json(servers);
}

export async function POST(req: Request, { params }: { params: { guildId: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'administrator');
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = (await req.json()) as { name: string; edition: string; host: string; port: number; statusChannelId?: string };
  const server = await prisma.minecraftServer.create({
    data: {
      guildId: params.guildId,
      name: body.name,
      edition: body.edition,
      host: body.host,
      port: body.port,
      statusChannelId: body.statusChannelId || null
    }
  });
  return NextResponse.json(server);
}
