import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import { isBotOwner } from '../../../../../services/permissions';
import { prisma } from '../../../../../database/prisma';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !isBotOwner(session.userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await prisma.premiumVoucher.delete({ where: { id: params.id } }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
