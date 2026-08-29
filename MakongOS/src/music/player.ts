import {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus
} from '@discordjs/voice';
import type { VoiceBasedChannel, TextBasedChannel, TextChannel } from 'discord.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { playDlProvider } from '../providers/music/playDlProvider';
import type { Track } from '../providers/music/types';
import { getMusicState, setMusicState, deleteMusicState, elapsedSeconds, type GuildMusicState } from './queueManager';
import { prisma } from '../database/prisma';
import { createLogger } from '../services/logger';
import { getBotClient } from '../bot/globalClient';

const log = createLogger('music');
const provider = playDlProvider;
const BAR_LENGTH = 18;

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function progressBar(elapsed: number, duration: number): string {
  if (duration <= 0) return '🔴 LIVE'.padEnd(BAR_LENGTH, ' ');
  const ratio = Math.min(1, elapsed / duration);
  const filled = Math.round(ratio * BAR_LENGTH);
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, BAR_LENGTH - filled));
}

export function buildNowPlayingEmbed(state: GuildMusicState): EmbedBuilder {
  const track = state.current!;
  const elapsed = elapsedSeconds(state);
  const bar = progressBar(elapsed, track.durationSec);
  const paused = state.pausedAt !== null;

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({ name: paused ? '⏸️ Paused' : '🎵 Now Playing' })
    .setTitle(track.title)
    .setURL(track.url)
    .setThumbnail(track.thumbnail ?? null)
    .setDescription(`\`${bar}\`\n${formatTime(elapsed)} / ${formatTime(track.durationSec)}`)
    .addFields(
      { name: 'Requested by', value: `<@${track.requestedById}>`, inline: true },
      { name: 'Loop', value: loopLabel(state.loop), inline: true },
      { name: 'Queue', value: `${state.queue.length} song${state.queue.length === 1 ? '' : 's'}`, inline: true }
    )
    .setFooter({ text: 'MakongOS Music' });
}

function loopLabel(loop: GuildMusicState['loop']): string {
  return loop === 'track' ? '🔂 Track' : loop === 'queue' ? '🔁 Queue' : '➡️ Off';
}

export function buildControlRow(state: GuildMusicState) {
  const paused = state.pausedAt !== null;
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('music_playpause').setEmoji(paused ? '▶️' : '⏸️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('music_shuffle').setEmoji('🔀').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_loop').setEmoji('🔁').setStyle(ButtonStyle.Secondary)
  );
}

async function refreshNowPlaying(state: GuildMusicState, textChannel: TextBasedChannel) {
  if (!state.nowPlayingMessageId || !state.current) return;
  const message = await textChannel.messages.fetch(state.nowPlayingMessageId).catch(() => null);
  if (!message) return;
  await message.edit({ embeds: [buildNowPlayingEmbed(state)], components: [buildControlRow(state)] }).catch(() => undefined);
}

export async function joinAndGetState(
  guildId: string,
  voiceChannel: VoiceBasedChannel,
  textChannel: TextBasedChannel
): Promise<GuildMusicState> {
  let state = getMusicState(guildId);
  if (state) return state;

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator
  });
  await entersState(connection, VoiceConnectionStatus.Ready, 15_000);

  const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
  connection.subscribe(player);

  state = {
    guildId,
    connection,
    player,
    textChannelId: textChannel.id,
    voiceChannelId: voiceChannel.id,
    queue: [],
    current: null,
    startedAt: Date.now(),
    pausedAt: null,
    loop: 'off',
    volume: 80,
    tracksPlayed: 0
  };
  setMusicState(guildId, state);

  player.on(AudioPlayerStatus.Idle, () => {
    void playNext(guildId).catch((err) => log.error('playNext failed', err));
  });
  player.on('error', (err) => log.error('Audio player error', err));

  await prisma.musicSession.create({ data: { guildId, channelId: voiceChannel.id, startedById: '' } }).catch(() => undefined);

  return state;
}

export async function enqueue(state: GuildMusicState, tracks: Track[]): Promise<void> {
  state.queue.push(...tracks);
  if (!state.current) await playNext(state.guildId);
}

export async function playNext(guildId: string): Promise<void> {
  const state = getMusicState(guildId);
  if (!state) return;

  if (state.loop === 'track' && state.current) {
    state.queue.unshift(state.current);
  } else if (state.loop === 'queue' && state.current) {
    state.queue.push(state.current);
  }

  const next = state.queue.shift();
  if (!next) {
    state.current = null;
    if (state.updateInterval) clearInterval(state.updateInterval);
    return;
  }

  state.current = next;
  state.startedAt = Date.now();
  state.pausedAt = null;
  state.tracksPlayed++;

  const { stream, type } = await provider.getStream(next);
  const resource = createAudioResource(stream, {
    inputType: type === 'opus' ? StreamType.Opus : type === 'webm/opus' ? StreamType.WebmOpus : StreamType.Arbitrary,
    inlineVolume: true
  });
  resource.volume?.setVolume(state.volume / 100);
  state.player.play(resource);

  const client = getBotClient();
  const fetched = client ? await client.channels.fetch(state.textChannelId).catch(() => null) : null;
  if (fetched?.isTextBased() && 'send' in fetched) {
    const textChannel = fetched as TextChannel;
    if (state.updateInterval) clearInterval(state.updateInterval);
    const message = await textChannel.send({ embeds: [buildNowPlayingEmbed(state)], components: [buildControlRow(state)] });
    state.nowPlayingMessageId = message.id;
    state.updateInterval = setInterval(() => {
      void refreshNowPlaying(state, textChannel).catch(() => undefined);
    }, 10_000);
  }
}

export function togglePause(state: GuildMusicState): boolean {
  if (state.pausedAt) {
    const pausedDuration = Date.now() - state.pausedAt;
    state.startedAt += pausedDuration;
    state.pausedAt = null;
    state.player.unpause();
    return false;
  }
  state.pausedAt = Date.now();
  state.player.pause();
  return true;
}

export function skip(state: GuildMusicState): void {
  state.player.stop();
}

export function shuffleQueue(state: GuildMusicState): void {
  for (let i = state.queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.queue[i], state.queue[j]] = [state.queue[j]!, state.queue[i]!];
  }
}

export function cycleLoop(state: GuildMusicState): void {
  state.loop = state.loop === 'off' ? 'queue' : state.loop === 'queue' ? 'track' : 'off';
}

export async function stopAndLeave(guildId: string): Promise<void> {
  const state = getMusicState(guildId);
  if (!state) return;
  state.queue = [];
  state.player.stop();
  state.connection.destroy();
  deleteMusicState(guildId);
  await prisma.musicSession.updateMany({ where: { guildId, endedAt: null }, data: { endedAt: new Date() } }).catch(() => undefined);
}
