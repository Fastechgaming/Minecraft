import { LavalinkManager, type Player } from 'lavalink-client';
import type { Client, TextChannel } from 'discord.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import playdl from 'play-dl';
import { createLogger } from '../services/logger';

const log = createLogger('music');

export type FilterName = 'bassboost' | 'nightcore' | '8d' | 'vaporwave' | 'tremolo';

export const FILTER_LABELS: Record<FilterName, string> = {
  bassboost: 'Bassboost',
  nightcore: 'Nightcore',
  '8d': '8D Audio',
  vaporwave: 'Vaporwave',
  tremolo: 'Tremolo'
};

/**
 * Builds the Lavalink connection from LAVALINK_HOST/PORT/PASSWORD. The bot's own
 * client id/username are filled in later via manager.init() once discord.js has
 * logged in (see bot/client.ts) — the node connection itself only happens on init().
 */
export function createLavalinkManager(client: Client): LavalinkManager {
  const manager = new LavalinkManager({
    nodes: [
      {
        id: 'main',
        host: process.env.LAVALINK_HOST || '127.0.0.1',
        port: Number(process.env.LAVALINK_PORT) || 2333,
        authorization: process.env.LAVALINK_PASSWORD || '',
        secure: false
      }
    ],
    sendToShard: (guildId, payload) => {
      client.guilds.cache.get(guildId)?.shard?.send(payload);
    },
    autoSkip: true,
    playerOptions: {
      defaultSearchPlatform: 'ytsearch',
      onDisconnect: { autoReconnect: false, destroyPlayer: true },
      onEmptyQueue: { destroyAfterMs: 30_000 }
    }
  });

  manager.nodeManager.on('connect', (node) => log.info(`Connected to Lavalink node "${node.id}"`));
  manager.nodeManager.on('error', (node, error) => log.error(`Lavalink node "${node.id}" error`, error));
  manager.nodeManager.on('disconnect', (node) => log.warn(`Disconnected from Lavalink node "${node.id}" — is it running? See scripts/setup-lavalink.sh`));

  manager.on('trackStart', (player) => {
    postNowPlaying(client, player).catch((err) => log.error('Failed to post now playing message', err));
  });
  manager.on('trackStuck', (player, track) => {
    sendToTextChannel(client, player, `⚠️ **${track?.info.title ?? 'Track'}** got stuck, skipping.`);
  });
  manager.on('trackError', (player, track, payload) => {
    log.error('Track error', payload.exception);
    sendToTextChannel(client, player, `⚠️ Failed to play **${track?.info.title ?? 'that track'}**, skipping.`);
  });
  manager.on('queueEnd', (player) => {
    sendToTextChannel(client, player, '📭 Queue finished.');
  });

  return manager;
}

export async function searchTrack(player: Player, query: string, requesterId: string) {
  const trimmed = query.trim();

  const spotifyType = playdl.sp_validate(trimmed);
  if (spotifyType === 'track') {
    const track = await playdl.spotify(trimmed);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = track as any;
    const search = `${t.name} ${(t.artists ?? []).map((a: { name: string }) => a.name).join(' ')}`.trim();
    return player.search({ query: search, source: 'ytsearch' }, requesterId);
  }

  const isUrl = /^https?:\/\//i.test(trimmed);
  return player.search(isUrl ? { query: trimmed } : { query: trimmed, source: 'ytsearch' }, requesterId);
}

export async function applyFilter(player: Player, filter: FilterName | null): Promise<void> {
  await player.filterManager.resetFilters();
  switch (filter) {
    case 'bassboost':
      await player.filterManager.setEQPreset('BassboostMedium');
      break;
    case 'nightcore':
      await player.filterManager.toggleNightcore();
      break;
    case 'vaporwave':
      await player.filterManager.toggleVaporwave();
      break;
    case 'tremolo':
      await player.filterManager.toggleTremolo();
      break;
    case '8d':
      await player.filterManager.toggleRotation();
      break;
  }
  player.setData('filterName', filter);
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function nowPlayingEmbed(player: Player): EmbedBuilder {
  const track = player.queue.current;
  const embed = new EmbedBuilder().setColor(0x1db954);
  if (!track) return embed.setTitle('Nothing playing').setDescription('Queue is empty.');

  const filterName = player.getData<FilterName | null>('filterName') ?? null;
  const upNext = player.queue.tracks[0];

  return embed
    .setTitle('🎶 Now Playing')
    .setDescription(`**[${track.info.title}](${track.info.uri})**`)
    .setThumbnail(track.info.artworkUrl ?? null)
    .addFields(
      { name: 'Duration', value: track.info.isStream ? 'Live' : formatDuration(track.info.duration), inline: true },
      { name: 'Requested by', value: `<@${track.requester as string}>`, inline: true },
      { name: 'Volume', value: `${player.volume}%`, inline: true },
      { name: 'Filter', value: filterName ? FILTER_LABELS[filterName] : 'None', inline: true },
      { name: 'Loop', value: player.repeatMode, inline: true },
      { name: 'Up next', value: upNext ? upNext.info.title : '—', inline: true }
    );
}

export function nowPlayingComponents(player: Player): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
  const filterName = player.getData<FilterName | null>('filterName') ?? null;
  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('music_pause').setLabel(player.paused ? 'Resume' : 'Pause').setEmoji(player.paused ? '▶️' : '⏸️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('music_skip').setLabel('Skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_stop').setLabel('Stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('music_loop').setLabel(`Loop: ${player.repeatMode}`).setEmoji('🔁').setStyle(ButtonStyle.Secondary)
  );
  const filterSelect = new StringSelectMenuBuilder()
    .setCustomId('music_filter_select')
    .setPlaceholder('Audio filter...')
    .addOptions([
      { label: 'None', value: 'none', default: !filterName },
      ...Object.entries(FILTER_LABELS).map(([value, label]) => ({ label, value, default: filterName === value }))
    ]);
  return [buttonRow, new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(filterSelect)];
}

async function getTextChannel(client: Client, player: Player): Promise<TextChannel | null> {
  if (!player.textChannelId) return null;
  const channel = await client.channels.fetch(player.textChannelId).catch(() => null);
  return channel?.isTextBased() && !channel.isDMBased() ? (channel as TextChannel) : null;
}

function sendToTextChannel(client: Client, player: Player, content: string): void {
  getTextChannel(client, player)
    .then((channel) => channel?.send(content))
    .catch(() => undefined);
}

export async function postNowPlaying(client: Client, player: Player): Promise<void> {
  const channel = await getTextChannel(client, player);
  if (!channel) return;

  const embed = nowPlayingEmbed(player);
  const components = nowPlayingComponents(player);
  const existingId = player.getData<string | null>('nowPlayingMessageId');

  if (existingId) {
    const edited = await channel.messages
      .fetch(existingId)
      .then((m) => m.edit({ embeds: [embed], components }))
      .catch(() => null);
    if (edited) return;
  }

  const message = await channel.send({ embeds: [embed], components });
  player.setData('nowPlayingMessageId', message.id);
}

export async function refreshNowPlaying(client: Client, player: Player): Promise<void> {
  const existingId = player.getData<string | null>('nowPlayingMessageId');
  if (!existingId) return;
  const channel = await getTextChannel(client, player);
  await channel?.messages
    .fetch(existingId)
    .then((m) => m.edit({ embeds: [nowPlayingEmbed(player)], components: nowPlayingComponents(player) }))
    .catch(() => undefined);
}
