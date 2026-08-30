import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import { prisma } from '../database/prisma';
import { createLogger } from '../services/logger';
import { recordAuditLog } from '../services/auditLog';

const log = createLogger('giveaways');
const GIVEAWAY_EMOJI = '🎉';

const DURATION_UNITS: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 60 * 60_000,
  d: 24 * 60 * 60_000
};

export function parseDuration(input: string): number | null {
  const match = input.trim().match(/^(\d+)\s*([smhd])$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2]!.toLowerCase();
  return amount * DURATION_UNITS[unit]!;
}

export function buildGiveawayEmbed(prize: string, winnerCount: number, hostedById: string, endsAt: Date, ended: boolean, winnerIds: string[] = []) {
  const embed = new EmbedBuilder()
    .setColor(ended ? 0x949ba4 : 0xf0b232)
    .setTitle(ended ? '🎉 Giveaway Ended' : '🎉 Giveaway')
    .setDescription(`**${prize}**\n\nReact with ${GIVEAWAY_EMOJI} to enter!`)
    .addFields(
      { name: 'Winners', value: `${winnerCount}`, inline: true },
      { name: 'Hosted by', value: `<@${hostedById}>`, inline: true },
      { name: ended ? 'Ended' : 'Ends', value: `<t:${Math.floor(endsAt.getTime() / 1000)}:R>`, inline: true }
    );
  if (ended) {
    embed.addFields({ name: 'Winner(s)', value: winnerIds.length ? winnerIds.map((id) => `<@${id}>`).join(', ') : 'No valid entries.' });
  }
  return embed;
}

export async function createGiveaway(
  channel: TextChannel,
  prize: string,
  winnerCount: number,
  hostedById: string,
  durationMs: number
) {
  const endsAt = new Date(Date.now() + durationMs);
  const message = await channel.send({ embeds: [buildGiveawayEmbed(prize, winnerCount, hostedById, endsAt, false)] });
  await message.react(GIVEAWAY_EMOJI).catch(() => undefined);

  return prisma.giveaway.create({
    data: { guildId: channel.guildId, channelId: channel.id, messageId: message.id, prize, winnerCount, hostedById, endsAt }
  });
}

async function pickWinners(client: Client, channelId: string, messageId: string, winnerCount: number): Promise<string[]> {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return [];
  const message = await (channel as TextChannel).messages.fetch(messageId).catch(() => null);
  if (!message) return [];

  const reaction = message.reactions.cache.get(GIVEAWAY_EMOJI);
  if (!reaction) return [];

  const users = await reaction.users.fetch();
  const entrants = users.filter((u) => !u.bot).map((u) => u.id);
  const shuffled = [...entrants].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, winnerCount);
}

export async function endGiveaway(client: Client, giveawayId: string): Promise<void> {
  const giveaway = await prisma.giveaway.findUnique({ where: { id: giveawayId } });
  if (!giveaway || giveaway.ended) return;

  const winnerIds = await pickWinners(client, giveaway.channelId, giveaway.messageId, giveaway.winnerCount);

  await prisma.giveaway.update({ where: { id: giveawayId }, data: { ended: true, winnerIds } });

  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (channel?.isTextBased()) {
    const message = await (channel as TextChannel).messages.fetch(giveaway.messageId).catch(() => null);
    await message?.edit({ embeds: [buildGiveawayEmbed(giveaway.prize, giveaway.winnerCount, giveaway.hostedById, giveaway.endsAt, true, winnerIds)] }).catch(() => undefined);

    if (winnerIds.length > 0) {
      await (channel as TextChannel)
        .send(`🎉 Congratulations ${winnerIds.map((id) => `<@${id}>`).join(', ')}! You won **${giveaway.prize}**!`)
        .catch(() => undefined);
    } else {
      await (channel as TextChannel).send(`😢 No valid entries — nobody won **${giveaway.prize}**.`).catch(() => undefined);
    }
  }

  await recordAuditLog(client, { guildId: giveaway.guildId, type: 'giveaway', action: 'ended', channelId: giveaway.channelId, details: { prize: giveaway.prize, winners: winnerIds.length } });
}

export async function rerollGiveaway(client: Client, giveawayId: string): Promise<string[]> {
  const giveaway = await prisma.giveaway.findUnique({ where: { id: giveawayId } });
  if (!giveaway) return [];

  const winnerIds = await pickWinners(client, giveaway.channelId, giveaway.messageId, giveaway.winnerCount);
  await prisma.giveaway.update({ where: { id: giveawayId }, data: { winnerIds } });

  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (channel?.isTextBased() && winnerIds.length > 0) {
    await (channel as TextChannel).send(`🔁 New winner(s) for **${giveaway.prize}**: ${winnerIds.map((id) => `<@${id}>`).join(', ')}!`).catch(() => undefined);
  }
  return winnerIds;
}

export async function sweepDueGiveaways(client: Client): Promise<void> {
  const due = await prisma.giveaway.findMany({ where: { ended: false, endsAt: { lte: new Date() } } });
  for (const giveaway of due) {
    await endGiveaway(client, giveaway.id).catch((err) => log.error(`Failed to end giveaway ${giveaway.id}`, err));
  }
}
