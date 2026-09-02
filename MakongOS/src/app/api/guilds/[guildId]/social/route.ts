import { NextResponse } from 'next/server';
import { authorizeGuildRequest } from '../../../../../lib/apiAuth';
import { prisma } from '../../../../../database/prisma';

export async function GET(_req: Request, { params }: { params: { guildId: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'viewer');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const alerts = await prisma.socialAlert.findMany({ where: { guildId: params.guildId } });
  return NextResponse.json(alerts);
}

export async function POST(req: Request, { params }: { params: { guildId: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'administrator');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await req.json()) as { platform: string; channelHandle: string; announceChannelId: string; message?: string };
  const alert = await prisma.socialAlert.upsert({
    where: { guildId_platform_channelHandle: { guildId: params.guildId, platform: body.platform, channelHandle: body.channelHandle } },
    update: { announceChannelId: body.announceChannelId, message: body.message || '{creator} is now live! {url}' },
    create: {
      guildId: params.guildId,
      platform: body.platform,
      channelHandle: body.channelHandle,
      announceChannelId: body.announceChannelId,
      message: body.message || '{creator} is now live! {url}'
    }
  });
  return NextResponse.json(alert);
}
