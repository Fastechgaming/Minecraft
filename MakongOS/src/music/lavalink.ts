import { LavalinkManager, type Player, type Track, type UnresolvedTrack } from 'lavalink-client';
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

// Guilds with a pending "empty voice channel" leave timer — cleared if someone rejoins
// before it fires. Module-level since the bot runs as a single process (see server.ts).
const emptyChannelTimers = new Map<string, NodeJS.Timeout>();
const EMPTY_CHANNEL_LEAVE_MS = 30_000;

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
  manager.on('queueEnd', (player, track) => {
    if (player.getData<boolean>('autoplay')) {
      autoplayNext(player, track).catch((err) => log.error('Autoplay failed', err));
    } else {
      sendToTextChannel(client, player, '📭 Queue finished.');
    }
  });
  manager.on('playerDestroy', (player) => {
    clearEmptyChannelTimer(player.guildId);
  });

  return manager;
}

/**
 * On queue-end with autoplay on, loads the last track's YouTube "mix" (its mix
 * playlist id is the video id prefixed with "RD") and queues a track from it that
 * isn't the one that just finished — a lightweight continuation, not a full
 * recommendation engine.
 */
async function autoplayNext(player: Player, lastTrack: Track | UnresolvedTrack | null): Promise<void> {
  const identifier = lastTrack?.info.identifier;
  if (!identifier) return;
  const result = await player.search({ query: `https://www.youtube.com/watch?v=${identifier}&list=RD${identifier}` }, 'autoplay');
  if (result.loadType === 'error' || result.tracks.length === 0) return;
  const next = result.tracks.find((t) => t.info.identifier !== identifier) ?? result.tracks[0];
  await player.queue.add(next);
  await player.play();
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

/** Restarts the current track from the beginning. */
export async function replayCurrent(player: Player): Promise<boolean> {
  if (!player.queue.current) return false;
  await player.seek(0);
  return true;
}

/** Re-queues and jumps back to the most recently played track, if any. */
export async function playPrevious(player: Player): Promise<boolean> {
  const prev = player.queue.previous[0];
  if (!prev) return false;
  await player.queue.splice(0, 0, prev);
  await player.skip();
  return true;
}

/** Removes every upcoming track without touching what's currently playing. */
export async function clearQueue(player: Player): Promise<void> {
  if (player.queue.tracks.length > 0) {
    await player.queue.splice(0, player.queue.tracks.length);
  }
}

export function toggleAutoplay(player: Player): boolean {
  const next = !player.getData<boolean>('autoplay');
  player.setData('autoplay', next);
  return next;
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function nowPlayingEmbed(player: Player): EmbedBuilder {
  const track = player.queue.current;
  const embed = new EmbedBuilder().setColor(0x22c55e);
  if (!track) return embed.setTitle('Nothing playing').setDescription('Queue is empty.');

  const filterName = player.getData<FilterName | null>('filterName') ?? null;
  const autoplay = Boolean(player.getData<boolean>('autoplay'));
  const upNext = player.queue.tracks[0];
  const requesterId = typeof track.requester === 'string' ? track.requester : undefined;
  const requestedBy = requesterId && /^\d+$/.test(requesterId) ? `<@${requesterId}>` : 'Autoplay';

  return embed
    .setTitle(player.paused ? '⏸️ Paused' : '🎶 Now Playing')
    .setDescription(`**[${track.info.title}](${track.info.uri})**`)
    .setThumbnail(track.info.artworkUrl ?? null)
    .addFields(
      { name: 'Duration', value: track.info.isStream ? 'Live' : formatDuration(track.info.duration), inline: true },
      { name: 'Requested by', value: requestedBy, inline: true },
      { name: 'Volume', value: `${player.volume}%`, inline: true },
      { name: 'Filter', value: filterName ? FILTER_LABELS[filterName] : 'None', inline: true },
      { name: 'Loop', value: player.repeatMode, inline: true },
      { name: 'Autoplay', value: autoplay ? 'On' : 'Off', inline: true },
      { name: 'Up next', value: upNext ? upNext.info.title : '—', inline: false }
    );
}

export function nowPlayingComponents(player: Player): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
  const filterName = player.getData<FilterName | null>('filterName') ?? null;
  const autoplay = Boolean(player.getData<boolean>('autoplay'));

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('music_playpause').setLabel(player.paused ? 'Play' : 'Pause').setEmoji(player.paused ? '▶️' : '⏸️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('music_replay').setLabel('Replay').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_previous').setLabel('Previous').setEmoji('⏮️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_skip').setLabel('Skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_clear').setLabel('Clear').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('music_autoplay').setLabel('Autoplay').setEmoji('✨').setStyle(autoplay ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_volume').setLabel('Volume').setEmoji('🔊').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_stop').setLabel('Stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('music_shuffle').setLabel('Shuffle').setEmoji('🔀').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_loop').setLabel(`Loop: ${player.repeatMode}`).setEmoji('🔁').setStyle(ButtonStyle.Secondary)
  );
  const filterSelect = new StringSelectMenuBuilder()
    .setCustomId('music_filter_select')
    .setPlaceholder('Audio filter...')
    .addOptions([
      { label: 'None', value: 'none', default: !filterName },
      ...Object.entries(FILTER_LABELS).map(([value, label]) => ({ label, value, default: filterName === value }))
    ]);
  return [row1, row2, new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(filterSelect)];
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

/** Stops playback and blanks the persistent Now Playing embed in place — used by both the Stop button and the /stop command so they behave identically. */
export async function stopAndClearNowPlaying(client: Client, player: Player): Promise<void> {
  const messageId = player.getData<string | null>('nowPlayingMessageId');
  const channel = await getTextChannel(client, player);
  await player.destroy().catch(() => undefined);
  if (!channel || !messageId) return;
  await channel.messages
    .fetch(messageId)
    .then((m) => m.edit({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle('⏹️ Stopped').setDescription('Playback stopped.')], components: [] }))
    .catch(() => undefined);
}

export function clearEmptyChannelTimer(guildId: string): void {
  const timer = emptyChannelTimers.get(guildId);
  if (timer) {
    clearTimeout(timer);
    emptyChannelTimers.delete(guildId);
  }
}

/**
 * Starts (or restarts) the 30s "everyone left" grace period for a player. If the
 * channel is still empty when it fires, the player is destroyed and a single
 * message is posted noting why — otherwise use clearEmptyChannelTimer to cancel.
 */
export function scheduleEmptyChannelLeave(client: Client, player: Player, voiceChannelName: string): void {
  clearEmptyChannelTimer(player.guildId);
  const timer = setTimeout(() => {
    emptyChannelTimers.delete(player.guildId);
    sendToTextChannel(client, player, `🚪 Nobody's in **${voiceChannelName}** — music closed.`);
    player.destroy().catch(() => undefined);
  }, EMPTY_CHANNEL_LEAVE_MS);
  emptyChannelTimers.set(player.guildId, timer);
}
