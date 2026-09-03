import { generate } from 'youtube-po-token-generator';
import { createLogger } from '../services/logger';

const log = createLogger('po-token');

const TTL_MS = 5 * 3_600_000; // PO tokens are tied to a visitor session, not single-use, but we refresh well before anything might expire.

interface CachedToken {
  poToken: string;
  visitorData: string;
  expiresAt: number;
}

let cached: CachedToken | null = null;
let pending: Promise<CachedToken | null> | null = null;

/**
 * YouTube requires a "proof of origin" token to hand out real streaming URLs on datacenter/VPS
 * IPs (confirmed on the production server: yt-dlp's built-in provider list is empty, and without
 * one the web client gets nothing but thumbnail formats). youtube-po-token-generator solves the
 * same challenge a real browser would via a headless DOM, all inside this same Node process — no
 * separate service, no Python plugin loading. Failures degrade gracefully: yt-dlp just falls back
 * to whatever it can get without a token, rather than this blocking playback outright.
 */
export async function getPoToken(): Promise<{ poToken: string; visitorData: string } | null> {
  if (cached && cached.expiresAt > Date.now()) return cached;
  if (pending) return pending;

  pending = (async () => {
    try {
      const { poToken, visitorData } = await generate();
      const token: CachedToken = { poToken, visitorData, expiresAt: Date.now() + TTL_MS };
      cached = token;
      log.info('Generated a fresh PO token');
      return token;
    } catch (err) {
      log.warn('Failed to generate a PO token — streaming will fall back to unauthenticated requests, which YouTube may throttle', err);
      return null;
    } finally {
      pending = null;
    }
  })();
  return pending;
}
