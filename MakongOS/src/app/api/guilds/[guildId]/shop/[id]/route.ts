import { NextResponse } from 'next/server';
import { authorizeGuildRequest } from '../../../../../../lib/apiAuth';
import { prisma } from '../../../../../../database/prisma';

export async function DELETE(_req: Request, { params }: { params: { guildId: string; id: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'administrator');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await prisma.shopItem.deleteMany({ where: { id: params.id, guildId: params.guildId } });
  return NextResponse.json({ ok: true });
}
