import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import playdl from 'play-dl';
import { createAudioResource, StreamType, AudioPlayerStatus, entersState, VoiceConnectionStatus } from '@discordjs/voice';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, type TextChannel } from 'discord.js';
import type { GuildQueue, Track } from './queueManager';
import { deleteQueue } from './queueManager';
import { buildAudioFilterChain, FILTER_LABELS, type FilterName } from './filters';
import { createLogger } from '../services/logger';

const log = createLogger('music');

export async function resolveTracks(query: string, requestedById: string): Promise<Track[]> {
  const trimmed = query.trim();

  if (playdl.yt_validate(trimmed) === 'video') {
    const info = await playdl.video_basic_info(trimmed);
    const d = info.video_details;
    return [{ title: d.title ?? 'Unknown title', url: d.url, durationSec: d.durationInSec, requestedById, thumbnail: d.thumbnails?.[0]?.url }];
  }

  const spotifyType = playdl.sp_validate(trimmed);
  if (spotifyType === 'track') {
    const track = await playdl.spotify(trimmed);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = track as any;
    const search = `${t.name} ${(t.artists ?? []).map((a: { name: string }) => a.name).join(' ')}`;
    const results = await playdl.search(search, { limit: 1, source: { youtube: 'video' } });
    if (results[0]) return [{ title: results[0].title ?? search, url: results[0].url, durationSec: results[0].durationInSec ?? 0, requestedById, thumbnail: results[0].thumbnails?.[0]?.url }];
    return [];
  }

  const results = await playdl.search(trimmed, { limit: 1, source: { youtube: 'video' } });
  if (!results[0]) return [];
  return [{ title: results[0].title ?? trimmed, url: results[0].url, durationSec: results[0].durationInSec ?? 0, requestedById, thumbnail: results[0].thumbnails?.[0]?.url }];
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function nowPlayingEmbed(queue: GuildQueue): EmbedBuilder {
  const track = queue.current;
  const embed = new EmbedBuilder().setColor(0x1db954);
  if (!track) return embed.setTitle('Nothing playing').setDescription('Queue is empty.');
  return embed
    .setTitle('🎶 Now Playing')
    .setDescription(`**[${track.title}](${track.url})**`)
    .setThumbnail(track.thumbnail ?? null)
    .addFields(
      { name: 'Duration', value: formatDuration(track.durationSec), inline: true },
      { name: 'Requested by', value: `<@${track.requestedById}>`, inline: true },
      { name: 'Volume', value: `${queue.volume}%`, inline: true },
      { name: 'Filter', value: queue.filter ? FILTER_LABELS[queue.filter] : 'None', inline: true },
      { name: 'Loop', value: queue.loop, inline: true },
      { name: 'Up next', value: queue.tracks[0] ? queue.tracks[0].title : '—', inline: true }
    );
}

export function nowPlayingComponents(queue: GuildQueue): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
  const paused = queue.player.state.status === AudioPlayerStatus.Paused;
  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('music_pause').setLabel(paused ? 'Resume' : 'Pause').setEmoji(paused ? '▶️' : '⏸️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('music_skip').setLabel('Skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_stop').setLabel('Stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('music_loop').setLabel(`Loop: ${queue.loop}`).setEmoji('🔁').setStyle(ButtonStyle.Secondary)
  );
  const filterSelect = new StringSelectMenuBuilder()
    .setCustomId('music_filter_select')
    .setPlaceholder('Audio filter...')
    .addOptions([
      { label: 'None', value: 'none', default: !queue.filter },
      ...Object.entries(FILTER_LABELS).map(([value, label]) => ({ label, value, default: queue.filter === value }))
    ]);
  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(filterSelect);
  return [buttonRow, selectRow];
}

async function updateNowPlayingMessage(queue: GuildQueue, textChannel: TextChannel) {
  if (!queue.nowPlayingMessageId) return;
  const message = await textChannel.messages.fetch(queue.nowPlayingMessageId).catch(() => null);
  await message?.edit({ embeds: [nowPlayingEmbed(queue)], components: nowPlayingComponents(queue) }).catch(() => undefined);
}

let ffmpegBin: string | null = null;
function spawnFfmpeg(filterChain: string): ChildProcessWithoutNullStreams {
  ffmpegBin = ffmpegBin ?? (ffmpegPath as unknown as string);
  return spawn(ffmpegBin, ['-i', 'pipe:0', '-analyzeduration', '0', '-loglevel', '0', '-af', filterChain, '-f', 'ogg', '-c:a', 'libopus', '-b:a', '128k', '-ar', '48000', '-ac', '2', 'pipe:1']);
}

export async function playNext(queue: GuildQueue, textChannel: TextChannel): Promise<void> {
  if (queue.destroyed) return;

  if (queue.loop === 'track' && queue.current) {
    queue.tracks.unshift(queue.current);
  } else if (queue.loop === 'queue' && queue.current) {
    queue.tracks.push(queue.current);
  }

  const next = queue.tracks.shift();
  if (!next) {
    queue.current = null;
    await textChannel.send('📭 Queue finished.').catch(() => undefined);
    return;
  }

  queue.current = next;
  queue.elapsedSec = 0;

  try {
    const source = await playdl.stream(next.url, { discordPlayerCompatibility: false });
    const ffmpeg = spawnFfmpeg(buildAudioFilterChain(queue.volume, queue.filter));
    source.stream.pipe(ffmpeg.stdin);
    ffmpeg.stderr.resume();
    const resource = createAudioResource(ffmpeg.stdout, { inputType: StreamType.OggOpus });
    queue.player.play(resource);
  } catch (err) {
    log.error('Failed to start track', err);
    await textChannel.send(`⚠️ Failed to play **${next.title}**, skipping.`).catch(() => undefined);
    return playNext(queue, textChannel);
  }

  const embed = nowPlayingEmbed(queue);
  const components = nowPlayingComponents(queue);
  if (queue.nowPlayingMessageId) {
    await textChannel.messages
      .fetch(queue.nowPlayingMessageId)
      .then((m) => m.edit({ embeds: [embed], components }))
      .catch(async () => {
        const message = await textChannel.send({ embeds: [embed], components });
        queue.nowPlayingMessageId = message.id;
      });
  } else {
    const message = await textChannel.send({ embeds: [embed], components });
    queue.nowPlayingMessageId = message.id;
  }
}

export function attachPlayerEvents(queue: GuildQueue, textChannel: TextChannel): void {
  queue.player.on(AudioPlayerStatus.Idle, () => {
    if (!queue.destroyed) playNext(queue, textChannel).catch((err) => log.error('playNext failed', err));
  });
  queue.player.on('error', (err) => {
    log.error('Audio player error', err);
    if (!queue.destroyed) playNext(queue, textChannel).catch(() => undefined);
  });
}

export async function restartCurrentTrack(queue: GuildQueue, textChannel: TextChannel): Promise<void> {
  if (!queue.current) return;
  queue.tracks.unshift(queue.current);
  await playNext(queue, textChannel);
}

export async function refreshNowPlaying(queue: GuildQueue, textChannel: TextChannel): Promise<void> {
  await updateNowPlayingMessage(queue, textChannel);
}

export async function waitForConnection(connection: import('@discordjs/voice').VoiceConnection): Promise<void> {
  await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
}

export function stopQueue(queue: GuildQueue): void {
  queue.destroyed = true;
  queue.player.stop(true);
  queue.connection.destroy();
  deleteQueue(queue.guildId);
}

export type { FilterName };
