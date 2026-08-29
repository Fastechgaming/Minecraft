import { NextResponse } from 'next/server';
import { authorizeGuildRequest } from '../../../../../lib/apiAuth';
import { prisma } from '../../../../../database/prisma';

export async function GET(_req: Request, { params }: { params: { guildId: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'viewer');
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const entries = await prisma.knowledgeBase.findMany({ where: { guildId: params.guildId }, orderBy: { category: 'asc' } });
  return NextResponse.json(entries);
}

export async function POST(req: Request, { params }: { params: { guildId: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'ai_manager');
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = (await req.json()) as { category: string; title: string; content: string; keywords?: string[] };
  const entry = await prisma.knowledgeBase.create({
    data: { guildId: params.guildId, category: body.category, title: body.title, content: body.content, keywords: body.keywords ?? [] }
  });
  return NextResponse.json(entry);
}
