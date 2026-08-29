import { NextResponse } from 'next/server';
import { authorizeGuildRequest } from '../../../../../lib/apiAuth';
import { pickEditableFields } from '../../../../../lib/settingsFields';
import { getGuildSettings, invalidateGuildSettings } from '../../../../../database/settingsCache';
import { prisma } from '../../../../../database/prisma';

export async function GET(_req: Request, { params }: { params: { guildId: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'viewer');
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const settings = await getGuildSettings(params.guildId);
  return NextResponse.json(settings);
}

export async function PATCH(req: Request, { params }: { params: { guildId: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'administrator');
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data = pickEditableFields(body);

  const updated = await prisma.guildSettings.upsert({
    where: { guildId: params.guildId },
    create: { guildId: params.guildId, ...data } as never,
    update: data as never
  });

  invalidateGuildSettings(params.guildId);
  return NextResponse.json(updated);
}
