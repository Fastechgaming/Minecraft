import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, type Client, type TextChannel } from 'discord.js';
import { prisma } from '../database/prisma';
import type { Giveaway } from '@prisma/client';
import { logAudit } from '../services/auditLog';

export function parseDuration(input: string): number | null {
  const match = /^(\d+)\s*(s|sec|m|min|h|hr|hour|d|day|w|week)s?$/i.exec(input.trim());
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier = unit.startsWith('s') ? 1000 : unit.startsWith('m') ? 60_000 : unit.startsWith('h') ? 3_600_000 : unit.startsWith('w') ? 604_800_000 : 86_400_000;
  return value * multiplier;
}

function giveawayButtons(giveawayId: string, ended = false): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`giveaway_enter_${giveawayId}`).setLabel('🎉 Enter').setStyle(ButtonStyle.Success).setDisabled(ended)
  );
}

export function buildGiveawayEmbed(giveaway: Giveaway): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`🎉 ${giveaway.prize}`)
    .setColor(giveaway.ended ? 0x99aab5 : 0xf1c40f)
    .setDescription(
      giveaway.ended
        ? giveaway.winnerIds.length > 0
          ? `Winner(s): ${giveaway.winnerIds.map((id) => `<@${id}>`).join(', ')}`
          : 'No valid entrants — no winner.'
        : `Click 🎉 Enter to join!\nEnds: <t:${Math.floor(giveaway.endsAt.getTime() / 1000)}:R>\nWinners: **${giveaway.winnerCount}**${giveaway.requiredRoleId ? `\nRequires: <@&${giveaway.requiredRoleId}>` : ''}`
    )
    .setFooter({ text: `${giveaway.entrantIds.length} entrant(s) · Hosted by` })
    .setTimestamp(giveaway.endsAt);
}

export async function createGiveaway(
  channel: TextChannel,
  hostId: string,
  prize: string,
  durationMs: number,
  winnerCount: number,
  requiredRoleId: string | null
) {
  const giveaway = await prisma.giveaway.create({
    data: { guildId: channel.guildId, channelId: channel.id, prize, winnerCount, hostId, requiredRoleId, endsAt: new Date(Date.now() + durationMs) }
  });
  const message = await channel.send({ embeds: [buildGiveawayEmbed(giveaway)], components: [giveawayButtons(giveaway.id)] });
  const updated = await prisma.giveaway.update({ where: { id: giveaway.id }, data: { messageId: message.id } });
  await logAudit(channel.guildId, 'giveaway', `Giveaway started: ${prize}`, hostId);
  return updated;
}

function pickWinners(entrantIds: string[], count: number): string[] {
  const pool = [...entrantIds];
  const winners: string[] = [];
  while (pool.length > 0 && winners.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    winners.push(pool.splice(index, 1)[0]);
  }
  return winners;
}

export async function endGiveaway(client: Client, giveawayId: string): Promise<Giveaway | null> {
  const giveaway = await prisma.giveaway.findUnique({ where: { id: giveawayId } });
  if (!giveaway || giveaway.ended) return null;

  const winners = pickWinners(giveaway.entrantIds, giveaway.winnerCount);
  const updated = await prisma.giveaway.update({ where: { id: giveaway.id }, data: { ended: true, winnerIds: winners } });

  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (channel?.isTextBased() && 'send' in channel) {
    await channel.messages.fetch(giveaway.messageId ?? '').then((m) => m.edit({ embeds: [buildGiveawayEmbed(updated)], components: [giveawayButtons(giveaway.id, true)] })).catch(() => undefined);
    await channel
      .send(winners.length > 0 ? `🎉 Congratulations ${winners.map((id) => `<@${id}>`).join(', ')}! You won **${giveaway.prize}**!` : `😔 No valid entrants for **${giveaway.prize}** — no winner.`)
      .catch(() => undefined);
  }
  await logAudit(giveaway.guildId, 'giveaway', `Giveaway ended: ${giveaway.prize}`, giveaway.hostId, { winners });
  return updated;
}

export async function rerollGiveaway(client: Client, giveawayId: string): Promise<Giveaway | null> {
  const giveaway = await prisma.giveaway.findUnique({ where: { id: giveawayId } });
  if (!giveaway || !giveaway.ended) return null;
  const winners = pickWinners(giveaway.entrantIds, giveaway.winnerCount);
  const updated = await prisma.giveaway.update({ where: { id: giveaway.id }, data: { winnerIds: winners } });

  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (channel?.isTextBased() && 'send' in channel) {
    await channel
      .send(winners.length > 0 ? `🔁 New winner(s) for **${giveaway.prize}**: ${winners.map((id) => `<@${id}>`).join(', ')}!` : `😔 No valid entrants to reroll for **${giveaway.prize}**.`)
      .catch(() => undefined);
  }
  return updated;
}

export async function sweepDueGiveaways(client: Client): Promise<void> {
  const due = await prisma.giveaway.findMany({ where: { ended: false, endsAt: { lte: new Date() } } });
  for (const giveaway of due) {
    await endGiveaway(client, giveaway.id).catch(() => undefined);
  }
}
