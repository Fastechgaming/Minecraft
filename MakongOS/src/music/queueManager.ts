import type { AudioPlayer, VoiceConnection } from '@discordjs/voice';
import type { FilterName } from './filters';

export interface Track {
  title: string;
  url: string;
  durationSec: number;
  requestedById: string;
  thumbnail?: string;
}

export interface GuildQueue {
  guildId: string;
  voiceChannelId: string;
  textChannelId: string;
  connection: VoiceConnection;
  player: AudioPlayer;
  tracks: Track[];
  current: Track | null;
  volume: number;
  filter: FilterName | null;
  loop: 'off' | 'track' | 'queue';
  nowPlayingMessageId: string | null;
  elapsedSec: number;
  destroyed: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var __makongosMusicQueues: Map<string, GuildQueue> | undefined;
}

const queues: Map<string, GuildQueue> = global.__makongosMusicQueues ?? new Map();
global.__makongosMusicQueues = queues;

export function getQueue(guildId: string): GuildQueue | undefined {
  return queues.get(guildId);
}

export function setQueue(guildId: string, queue: GuildQueue): void {
  queues.set(guildId, queue);
}

export function deleteQueue(guildId: string): void {
  queues.delete(guildId);
}
