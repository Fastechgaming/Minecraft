import playDl from 'play-dl';
import type { MusicProvider, Track } from './types';

/**
 * Default music provider backed by play-dl. Swappable — implement
 * MusicProvider against any other backend (Spotify metadata + YouTube
 * playback, Lavalink, SoundCloud, etc.) without touching the queue manager
 * or the /play command.
 */
export const playDlProvider: MusicProvider = {
  name: 'play-dl',

  async search(query: string): Promise<Track[]> {
    const isUrl = /^https?:\/\//i.test(query);
    if (isUrl) {
      const info = await playDl.video_basic_info(query);
      return [
        {
          title: info.video_details.title ?? query,
          url: info.video_details.url,
          durationSec: info.video_details.durationInSec ?? 0,
          thumbnail: info.video_details.thumbnails?.at(-1)?.url,
          requestedById: ''
        }
      ];
    }

    const results = await playDl.search(query, { limit: 5, source: { youtube: 'video' } });
    return results.map((v) => ({
      title: v.title ?? query,
      url: v.url,
      durationSec: v.durationInSec ?? 0,
      thumbnail: v.thumbnails?.at(-1)?.url,
      requestedById: ''
    }));
  },

  async getStream(track: Track) {
    const source = await playDl.stream(track.url, { quality: 2 });
    return { stream: source.stream, type: source.type as 'opus' | 'webm/opus' | 'arbitrary' };
  }
};
