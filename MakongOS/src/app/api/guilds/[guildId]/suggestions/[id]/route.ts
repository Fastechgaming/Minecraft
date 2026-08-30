import { NextResponse } from 'next/server';
import { EmbedBuilder } from 'discord.js';
import { authorizeGuildRequest } from '../../../../../../lib/apiAuth';
import { prisma } from '../../../../../../database/prisma';
import { getBotClient } from '../../../../../../bot/globalClient';

export async function PATCH(req: Request, { params }: { params: { guildId: string; id: string } }) {
  const auth = await authorizeGuildRequest(params.guildId, 'support');
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await req.json()) as { status: 'approved' | 'rejected'; reason?: string };
  const suggestion = await prisma.suggestion.findUnique({ where: { id: params.id } });
  if (!suggestion) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = await prisma.suggestion.update({
    where: { id: params.id },
    data: { status: body.status, reviewedById: auth.userId, reviewReason: body.reason, reviewedAt: new Date() }
  });

  const client = getBotClient();
  const channel = client ? await client.channels.fetch(suggestion.channelId).catch(() => null) : null;
  if (channel?.isTextBased()) {
    const message = await channel.messages.fetch(suggestion.messageId).catch(() => null);
    const embed = message?.embeds[0];
    if (message && embed) {
      const color = body.status === 'approved' ? 0x23a559 : 0xda373c;
      const rebuilt = EmbedBuilder.from(embed).setColor(color);
      const fields = (embed.fields ?? []).filter((f) => f.name !== 'Status' && f.name !== 'Staff Note');
      rebuilt.setFields([...fields, { name: 'Status', value: body.status, inline: true }, ...(body.reason ? [{ name: 'Staff Note', value: body.reason }] : [])]);
      await message.edit({ embeds: [rebuilt] }).catch(() => undefined);
    }
  }

  return NextResponse.json(updated);
}
