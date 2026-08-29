import { NextResponse } from 'next/server';
import { authorizeGuildRequest } from '../../../../../../../lib/apiAuth';
import { prisma } from '../../../../../../../database/prisma';

export async function DELETE(_req: Request, { params }: { params: { guildId: string; id: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'administrator');
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await prisma.ticketCategory.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
