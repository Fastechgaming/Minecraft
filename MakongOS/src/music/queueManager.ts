import type { AudioPlayer, VoiceConnection } from '@discordjs/voice';
import type { Track } from '../providers/music/types';

export type LoopMode = 'off' | 'track' | 'queue';

export interface GuildMusicState {
  guildId: string;
  connection: VoiceConnection;
  player: AudioPlayer;
  textChannelId: string;
  voiceChannelId: string;
  queue: Track[];
  current: Track | null;
  startedAt: number;
  pausedAt: number | null;
  loop: LoopMode;
  volume: number;
  nowPlayingMessageId?: string;
  updateInterval?: NodeJS.Timeout;
  tracksPlayed: number;
}

const states = new Map<string, GuildMusicState>();

export function getMusicState(guildId: string): GuildMusicState | undefined {
  return states.get(guildId);
}

export function setMusicState(guildId: string, state: GuildMusicState): void {
  states.set(guildId, state);
}

export function deleteMusicState(guildId: string): void {
  const state = states.get(guildId);
  if (state?.updateInterval) clearInterval(state.updateInterval);
  states.delete(guildId);
}

export function elapsedSeconds(state: GuildMusicState): number {
  const end = state.pausedAt ?? Date.now();
  return Math.max(0, Math.floor((end - state.startedAt) / 1000));
}
