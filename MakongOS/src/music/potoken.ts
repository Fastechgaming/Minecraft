import { spawn } from 'node:child_process';
import path from 'node:path';
import { createLogger } from '../services/logger';

const log = createLogger('po-token');

const SUCCESS_TTL_MS = 5 * 3_600_000; // PO tokens are tied to a visitor session, not single-use, but we refresh well before anything might expire.
const FAILURE_COOLDOWN_MS = 5 * 60_000; // Don't let every /play re-attempt a slow, doomed generation — wait a bit before retrying after a failure.
const GENERATE_TIMEOUT_MS = 60_000; // This VPS runs at ~100% host CPU from other apps sharing the box, so jsdom's challenge-solving can be slow — err generous.
const GENERATOR_SCRIPT = path.join(process.cwd(), 'node_modules', 'youtube-po-token-generator', 'bin', 'cli.mjs');

interface CachedToken {
  poToken: string;
  visitorData: string;
}

let cached: CachedToken | null = null;
let cacheExpiresAt = 0;
let pending: Promise<CachedToken | null> | null = null;

/** Runs the generator's own CLI as a short-lived child process, capped at a modest heap size. */
function runGenerator(): Promise<{ poToken: string; visitorData: string } | null> {
  return new Promise((resolve) => {
    const proc = spawn(process.execPath, ['--max-old-space-size=512', GENERATOR_SCRIPT]);
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGKILL');
      log.warn(`PO token generation timed out after ${GENERATE_TIMEOUT_MS / 1000}s, killed the subprocess`);
      resolve(null);
    }, GENERATE_TIMEOUT_MS);

    proc.stdout.on('data', (chunk) => (stdout += chunk));
    proc.stderr.on('data', (chunk) => (stderr += chunk));
    proc.on('error', (err) => {
      clearTimeout(timer);
      log.warn('Failed to spawn PO token generator', err);
      resolve(null);
    });
    proc.on('close', (code, signal) => {
      clearTimeout(timer);
      if (timedOut) return; // already logged and resolved by the timeout above — this SIGKILL was ours, not a crash.
      if (code !== 0) {
        const reason = signal ? `killed by signal ${signal} (likely out of memory — try raising --max-old-space-size)` : `exited ${code}`;
        log.warn(`PO token generator ${reason}: ${stderr.slice(0, 300) || stdout.slice(0, 300)}`);
        resolve(null);
        return;
      }
      try {
        const data = JSON.parse(stdout.trim());
        if (!data.poToken || !data.visitorData) {
          resolve(null);
          return;
        }
        resolve({ poToken: data.poToken, visitorData: data.visitorData });
      } catch (err) {
        log.warn('Failed to parse PO token generator output', err);
        resolve(null);
      }
    });
  });
}

/**
 * YouTube requires a "proof of origin" token to hand out real streaming URLs on datacenter/VPS
 * IPs (confirmed on the production server: without one, the web client returns thumbnail-only
 * formats). youtube-po-token-generator solves the same challenge a real browser would via a
 * headless DOM (jsdom) — but that can use a meaningful chunk of memory and CPU, so it's run as
 * its own short-lived child process (capped at --max-old-space-size=512) rather than in-process,
 * so a spike or a stuck run can never take the main bot process down with it. A failed attempt is
 * cached too (briefly) so a slow, doomed generation doesn't re-run on every single /play.
 */
export async function getPoToken(): Promise<{ poToken: string; visitorData: string } | null> {
  if (Date.now() < cacheExpiresAt) return cached;
  if (pending) return pending;

  pending = (async () => {
    try {
      const result = await runGenerator();
      cached = result;
      cacheExpiresAt = Date.now() + (result ? SUCCESS_TTL_MS : FAILURE_COOLDOWN_MS);
      log.info(result ? 'Generated a fresh PO token' : `PO token generation failed — will retry in ${FAILURE_COOLDOWN_MS / 60_000}m`);
      return result;
    } finally {
      pending = null;
    }
  })();
  return pending;
}
