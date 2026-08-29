import { NextResponse } from 'next/server';
import { authorizeGuildRequest } from '../../../../../../lib/apiAuth';
import { prisma } from '../../../../../../database/prisma';

export async function PATCH(req: Request, { params }: { params: { guildId: string; id: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'ai_manager');
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = (await req.json()) as { category?: string; title?: string; content?: string; keywords?: string[] };
  const entry = await prisma.knowledgeBase.update({
    where: { id: params.id },
    data: { category: body.category, title: body.title, content: body.content, keywords: body.keywords }
  });
  return NextResponse.json(entry);
}

export async function DELETE(_req: Request, { params }: { params: { guildId: string; id: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'ai_manager');
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await prisma.knowledgeBase.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
