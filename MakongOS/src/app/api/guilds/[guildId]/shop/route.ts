import { NextResponse } from 'next/server';
import { authorizeGuildRequest } from '../../../../../lib/apiAuth';
import { prisma } from '../../../../../database/prisma';

export async function GET(_req: Request, { params }: { params: { guildId: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'viewer');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const items = await prisma.shopItem.findMany({ where: { guildId: params.guildId }, orderBy: { price: 'asc' } });
  return NextResponse.json(items);
}

export async function POST(req: Request, { params }: { params: { guildId: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'administrator');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await req.json()) as { name: string; description?: string; price: number; roleId?: string; emoji?: string; stock?: number | null };
  const item = await prisma.shopItem.create({
    data: {
      guildId: params.guildId,
      name: body.name,
      description: body.description,
      price: body.price,
      roleId: body.roleId || null,
      emoji: body.emoji || '📦',
      stock: body.stock ?? null
    }
  });
  return NextResponse.json(item);
}
