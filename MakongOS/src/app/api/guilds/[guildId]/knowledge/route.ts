import { NextResponse } from 'next/server';
import { authorizeGuildRequest } from '../../../../../lib/apiAuth';
import { prisma } from '../../../../../database/prisma';

export async function GET(_req: Request, { params }: { params: { guildId: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'viewer');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const entries = await prisma.knowledgeBase.findMany({ where: { guildId: params.guildId }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json(entries);
}

export async function POST(req: Request, { params }: { params: { guildId: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'ai_manager');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await req.json()) as { question: string; answer: string; category?: string };
  const entry = await prisma.knowledgeBase.create({
    data: { guildId: params.guildId, question: body.question, answer: body.answer, category: body.category || 'general', addedById: auth.userId }
  });
  return NextResponse.json(entry);
}
