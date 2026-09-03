import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import playdl from 'play-dl';
import { createAudioResource, StreamType, AudioPlayerStatus, entersState, VoiceConnectionStatus } from '@discordjs/voice';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, type TextChannel } from 'discord.js';
import type { GuildQueue, Track } from './queueManager';
import { deleteQueue } from './queueManager';
import { buildAudioFilterChain, FILTER_LABELS, type FilterName } from './filters';
import { createLogger } from '../services/logger';
import { withTimeout } from '../services/timeout';
import { ensureYtDlp, ensureCookieFile, ytDlpResolveUrl, ytDlpSearch, ytDlpStream } from './ytdlp';

const log = createLogger('music');

const ffmpegBinPath = ffmpegPath as unknown as string;

/**
 * YouTube blocks/throttles the actual media-stream request from datacenter
 * IPs — search and basic page loads still succeed, which is what makes this
 * confusing to diagnose, but the stream itself stalls or 403s. yt-dlp is
 * downloaded (and kept ready) here since it's actively updated to counter
 * YouTube's anti-bot changes, unlike play-dl which we only still use for
 * Spotify track metadata below. YOUTUBE_COOKIE, if set, is also converted
 * into a cookie file yt-dlp can use for extra headroom against throttling.
 */
export async function prepareMusicEngine(): Promise<void> {
  try {
    await ensureYtDlp();
    const cookieFile = await ensureCookieFile();
    log.info(cookieFile ? 'yt-dlp ready with YOUTUBE_COOKIE' : 'yt-dlp ready (no YOUTUBE_COOKIE set — fine for most videos, but set one if streams keep failing)');
  } catch (err) {
    log.error('Failed to prepare yt-dlp', err);
  }
}

export async function resolveTracks(query: string, requestedById: string): Promise<Track[]> {
  const trimmed = query.trim();

  const spotifyType = playdl.sp_validate(trimmed);
  if (spotifyType === 'track') {
    const track = await playdl.spotify(trimmed);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = track as any;
    const search = `${t.name} ${(t.artists ?? []).map((a: { name: string }) => a.name).join(' ')}`;
    const meta = await ytDlpSearch(search);
    if (meta) return [{ title: meta.title, url: meta.url, durationSec: meta.durationSec, requestedById, thumbnail: meta.thumbnail }];
    return [];
  }

  const isUrl = /^https?:\/\//i.test(trimmed);
  const meta = isUrl ? await ytDlpResolveUrl(trimmed) : await ytDlpSearch(trimmed);
  if (!meta) return [];
  return [{ title: meta.title, url: meta.url, durationSec: meta.durationSec, requestedById, thumbnail: meta.thumbnail }];
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

function spawnFfmpeg(filterChain: string): ChildProcessWithoutNullStreams {
  return spawn(ffmpegBinPath, ['-i', 'pipe:0', '-analyzeduration', '0', '-loglevel', '0', '-af', filterChain, '-f', 'ogg', '-c:a', 'libopus', '-b:a', '128k', '-ar', '48000', '-ac', '2', 'pipe:1']);
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
    const ytdlp = await ytDlpStream(next.url, ffmpegBinPath);
    let stderr = '';
    ytdlp.stderr.on('data', (chunk) => (stderr += chunk));

    // Wait for yt-dlp to actually have data ready (not just for the process to spawn) before
    // declaring success — spawning is near-instant, but the real network fetch happens after,
    // and that's the step that can silently stall. 'readable' peeks without consuming, so the
    // later .pipe() below still gets every byte from the start.
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        const onReadable = () => {
          cleanup();
          resolve();
        };
        const onError = (err: Error) => {
          cleanup();
          reject(err);
        };
        const onExit = (code: number | null) => {
          cleanup();
          reject(new Error(`yt-dlp exited with code ${code}: ${stderr.slice(0, 300) || '(no stderr)'}`));
        };
        function cleanup() {
          ytdlp.stdout.off('readable', onReadable);
          ytdlp.off('error', onError);
          ytdlp.off('exit', onExit);
        }
        ytdlp.stdout.once('readable', onReadable);
        ytdlp.once('error', onError);
        ytdlp.once('exit', onExit);
      }),
      15_000,
      'Stream fetch timed out'
    );

    const ffmpeg = spawnFfmpeg(buildAudioFilterChain(queue.volume, queue.filter));
    ytdlp.stdout.pipe(ffmpeg.stdin);
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
