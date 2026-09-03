import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, chmod, writeFile, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import path from 'node:path';
import { createLogger } from '../services/logger';

const log = createLogger('yt-dlp');

const VENDOR_DIR = path.join(process.cwd(), '.vendor');
const BIN_PATH = path.join(VENDOR_DIR, 'yt-dlp');
const DOWNLOAD_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
const MAX_AGE_MS = 14 * 86_400_000;

let ensurePromise: Promise<string> | null = null;

async function downloadYtDlp(): Promise<void> {
  await mkdir(VENDOR_DIR, { recursive: true });
  log.info('Downloading yt-dlp...');
  const res = await fetch(DOWNLOAD_URL, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`Failed to download yt-dlp: HTTP ${res.status}`);
  const file = createWriteStream(BIN_PATH);
  await finished(Readable.fromWeb(res.body as never).pipe(file));
  await chmod(BIN_PATH, 0o755);
  log.info('yt-dlp downloaded');
}

/**
 * yt-dlp is downloaded on first use rather than bundled or npm-installed —
 * it's a single self-contained Linux binary (no Python needed) and needs to
 * stay current, since keeping up with YouTube's anti-bot changes is its
 * entire reason to exist. Cached at .vendor/yt-dlp (outside dist/, so it
 * survives `deploy.sh`'s rebuilds) and re-downloaded if it's more than two
 * weeks old, so it doesn't silently go stale over a long-running deploy.
 */
export async function ensureYtDlp(): Promise<string> {
  if (ensurePromise) return ensurePromise;
  ensurePromise = (async () => {
    if (existsSync(BIN_PATH)) {
      const age = Date.now() - (await stat(BIN_PATH)).mtimeMs;
      if (age < MAX_AGE_MS) return BIN_PATH;
      log.info('yt-dlp is more than 14 days old, refreshing...');
    }
    try {
      await downloadYtDlp();
    } catch (err) {
      if (existsSync(BIN_PATH)) {
        log.warn('yt-dlp refresh failed, continuing with existing binary', err);
      } else {
        throw err;
      }
    }
    return BIN_PATH;
  })();
  return ensurePromise;
}

let cookieFilePromise: Promise<string | undefined> | null = null;

/** Converts the raw "name=value; name=value" cookie header (used for play-dl) into the Netscape cookie-file format yt-dlp expects. */
export async function ensureCookieFile(): Promise<string | undefined> {
  if (cookieFilePromise) return cookieFilePromise;
  cookieFilePromise = (async () => {
    const raw = process.env.YOUTUBE_COOKIE;
    if (!raw) return undefined;
    const expiry = Math.floor(Date.now() / 1000) + 365 * 86400;
    const lines = raw
      .split(';')
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const eq = pair.indexOf('=');
        if (eq === -1) return null;
        const name = pair.slice(0, eq).trim();
        const value = pair.slice(eq + 1).trim();
        return `.youtube.com\tTRUE\t/\tTRUE\t${expiry}\t${name}\t${value}`;
      })
      .filter((l): l is string => l !== null);
    if (lines.length === 0) return undefined;

    await mkdir(VENDOR_DIR, { recursive: true });
    const cookieFilePath = path.join(VENDOR_DIR, 'youtube-cookies.txt');
    await writeFile(cookieFilePath, `# Netscape HTTP Cookie File\n${lines.join('\n')}\n`, 'utf8');
    return cookieFilePath;
  })();
  return cookieFilePromise;
}

export interface YtDlpMeta {
  title: string;
  url: string;
  durationSec: number;
  thumbnail?: string;
}

function runYtDlpJson(bin: string, args: string[]): Promise<YtDlpMeta | null> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, ['--no-warnings', '--skip-download', '-j', ...args]);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk) => (stdout += chunk));
    proc.stderr.on('data', (chunk) => (stderr += chunk));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0 || !stdout.trim()) {
        if (code !== 0) log.warn(`yt-dlp exited ${code}: ${stderr.slice(0, 300)}`);
        resolve(null);
        return;
      }
      try {
        const data = JSON.parse(stdout.trim().split('\n')[0]);
        resolve({
          title: data.title ?? 'Unknown title',
          url: data.webpage_url ?? data.original_url ?? data.url,
          durationSec: Math.round(data.duration ?? 0),
          thumbnail: Array.isArray(data.thumbnails) ? data.thumbnails.at(-1)?.url : data.thumbnail
        });
      } catch (err) {
        reject(err);
      }
    });
  });
}

async function cookieArgs(): Promise<string[]> {
  const cookieFile = await ensureCookieFile();
  return cookieFile ? ['--cookies', cookieFile] : [];
}

export async function ytDlpResolveUrl(url: string): Promise<YtDlpMeta | null> {
  const bin = await ensureYtDlp();
  return runYtDlpJson(bin, [...(await cookieArgs()), url]);
}

export async function ytDlpSearch(query: string): Promise<YtDlpMeta | null> {
  const bin = await ensureYtDlp();
  return runYtDlpJson(bin, [...(await cookieArgs()), `ytsearch1:${query}`]);
}

/** Spawns yt-dlp streaming best-effort audio to stdout for the caller to pipe into ffmpeg. */
export async function ytDlpStream(url: string, ffmpegLocation: string): Promise<ChildProcessWithoutNullStreams> {
  const bin = await ensureYtDlp();
  return spawn(bin, ['--no-warnings', '--quiet', '-f', 'bestaudio/best', '--ffmpeg-location', ffmpegLocation, ...(await cookieArgs()), '-o', '-', url]);
}
