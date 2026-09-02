import { NextResponse } from 'next/server';
import { authorizeGuildRequest } from '../../../../../lib/apiAuth';
import { prisma } from '../../../../../database/prisma';
import { invalidateGuildSettings } from '../../../../../database/settingsCache';
import { EDITABLE_SETTINGS_FIELDS } from '../../../../../lib/settingsFields';

export async function GET(_req: Request, { params }: { params: { guildId: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'viewer');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const settings = await prisma.guildSettings.upsert({ where: { guildId: params.guildId }, update: {}, create: { guildId: params.guildId } });
  return NextResponse.json(settings);
}

export async function PATCH(req: Request, { params }: { params: { guildId: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'administrator');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  for (const key of EDITABLE_SETTINGS_FIELDS) {
    if (key in body) data[key] = body[key];
  }

  const updated = await prisma.guildSettings.update({ where: { guildId: params.guildId }, data });
  invalidateGuildSettings(params.guildId);
  return NextResponse.json(updated);
}
