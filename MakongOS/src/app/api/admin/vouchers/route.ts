import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { randomBytes } from 'node:crypto';
import { authOptions } from '../../../../lib/auth';
import { isBotOwner } from '../../../../services/permissions';
import { prisma } from '../../../../database/prisma';

async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !isBotOwner(session.userId)) return null;
  return session.userId;
}

export async function GET() {
  const userId = await requireOwner();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const vouchers = await prisma.premiumVoucher.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(vouchers);
}

export async function POST(req: Request) {
  const userId = await requireOwner();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { plan?: string };
  const code = randomBytes(8).toString('hex').toUpperCase();
  const voucher = await prisma.premiumVoucher.create({ data: { code, plan: body.plan || 'premium', createdById: userId } });
  return NextResponse.json(voucher);
}
