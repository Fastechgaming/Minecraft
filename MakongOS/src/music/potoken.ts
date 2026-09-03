import { spawn } from 'node:child_process';
import path from 'node:path';
import { createLogger } from '../services/logger';

const log = createLogger('po-token');

const TTL_MS = 5 * 3_600_000; // PO tokens are tied to a visitor session, not single-use, but we refresh well before anything might expire.
const GENERATOR_SCRIPT = path.join(process.cwd(), 'node_modules', 'youtube-po-token-generator', 'bin', 'cli.mjs');

interface CachedToken {
  poToken: string;
  visitorData: string;
  expiresAt: number;
}

let cached: CachedToken | null = null;
let pending: Promise<CachedToken | null> | null = null;

/** Runs the generator's own CLI as a short-lived child process, capped at a modest heap size. */
function runGenerator(): Promise<{ poToken: string; visitorData: string } | null> {
  return new Promise((resolve) => {
    const proc = spawn(process.execPath, ['--max-old-space-size=512', GENERATOR_SCRIPT]);
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      log.warn('PO token generation timed out after 30s, killed the subprocess');
      resolve(null);
    }, 30_000);

    proc.stdout.on('data', (chunk) => (stdout += chunk));
    proc.stderr.on('data', (chunk) => (stderr += chunk));
    proc.on('error', (err) => {
      clearTimeout(timer);
      log.warn('Failed to spawn PO token generator', err);
      resolve(null);
    });
    proc.on('close', (code, signal) => {
      clearTimeout(timer);
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
 * headless DOM (jsdom) — but that can use a meaningful chunk of memory, so it's run as its own
 * short-lived child process (capped at --max-old-space-size=512, killed after 30s) rather than
 * in-process, so a spike or a stuck run can never take the main bot process down with it.
 */
export async function getPoToken(): Promise<{ poToken: string; visitorData: string } | null> {
  if (cached && cached.expiresAt > Date.now()) return cached;
  if (pending) return pending;

  pending = (async () => {
    try {
      const result = await runGenerator();
      if (!result) return null;
      const token: CachedToken = { ...result, expiresAt: Date.now() + TTL_MS };
      cached = token;
      log.info('Generated a fresh PO token');
      return token;
    } finally {
      pending = null;
    }
  })();
  return pending;
}
