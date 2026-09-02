import { NextResponse } from 'next/server';
import { authorizeGuildRequest } from '../../../../../../lib/apiAuth';
import { prisma } from '../../../../../../database/prisma';

export async function PATCH(req: Request, { params }: { params: { guildId: string; name: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'administrator');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await req.json()) as { enabled: boolean };

  const config = await prisma.commandConfig.upsert({
    where: { guildId_name: { guildId: params.guildId, name: params.name } },
    update: { enabled: body.enabled },
    create: { guildId: params.guildId, name: params.name, enabled: body.enabled }
  });
  return NextResponse.json(config);
}
