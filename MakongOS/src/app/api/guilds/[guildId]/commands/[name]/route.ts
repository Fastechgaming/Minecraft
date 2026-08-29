import { NextResponse } from 'next/server';
import { authorizeGuildRequest } from '../../../../../../lib/apiAuth';
import { prisma } from '../../../../../../database/prisma';

export async function PATCH(req: Request, { params }: { params: { guildId: string; name: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'administrator');
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    enabled?: boolean;
    cooldownSec?: number;
    allowedRoleIds?: string[];
    disabledChannelIds?: string[];
  };

  const data = {
    enabled: body.enabled,
    cooldownSec: body.cooldownSec,
    allowedRoleIds: body.allowedRoleIds,
    disabledChannelIds: body.disabledChannelIds
  };

  const updated = await prisma.commandConfig.upsert({
    where: { guildId_commandName: { guildId: params.guildId, commandName: params.name } },
    create: { guildId: params.guildId, commandName: params.name, ...data } as never,
    update: data as never
  });

  return NextResponse.json(updated);
}
