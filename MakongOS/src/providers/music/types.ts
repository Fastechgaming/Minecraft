import type { Readable } from 'node:stream';

export interface Track {
  title: string;
  url: string;
  durationSec: number;
  thumbnail?: string;
  requestedById: string;
}

export interface MusicProvider {
  name: string;
  search(query: string): Promise<Track[]>;
  getStream(track: Track): Promise<{ stream: Readable; type: 'opus' | 'webm/opus' | 'arbitrary' }>;
}
