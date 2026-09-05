import type { TextChannel } from 'discord.js';
import { getBotClient } from '../bot/globalClient';
import { prisma } from '../database/prisma';
import { buildPanelMessage } from './render';

/** Posts (or reposts, optionally into a different channel) a saved panel's message and records the new message id. */
export async function postPanelMessage(panelId: string, targetChannelId?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const panel = await prisma.ticketPanel.findUnique({ where: { id: panelId }, include: { categories: true } });
  if (!panel) return { ok: false, error: 'Panel not found' };

  const client = getBotClient();
  const guild = client?.guilds.cache.get(panel.guildId);
  if (!guild) return { ok: false, error: 'Bot is not online in this server' };

  const channelId = targetChannelId ?? panel.channelId;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return { ok: false, error: 'That channel was not found, or is not a text channel' };

  if (panel.messageId) {
    const oldChannel = channelId === panel.channelId ? channel : await guild.channels.fetch(panel.channelId).catch(() => null);
    if (oldChannel?.isTextBased()) await (oldChannel as TextChannel).messages.delete(panel.messageId).catch(() => undefined);
  }

  const payload = buildPanelMessage(panel, panel.categories);
  const message = await (channel as TextChannel).send({ content: payload.content, embeds: payload.embeds, components: payload.components });
  await prisma.ticketPanel.update({ where: { id: panel.id }, data: { channelId, messageId: message.id, lastSeenAt: new Date() } });
  return { ok: true };
}
