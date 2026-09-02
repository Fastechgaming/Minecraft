const BLOCKED_TERMS = [
  'nude', 'naked', 'nsfw', 'porn', 'sex', 'hentai', 'explicit', 'gore', 'child',
  'loli', 'shota', 'bestiality', 'rape', 'incest'
];

export function isPromptSafe(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return !BLOCKED_TERMS.some((term) => lower.includes(term));
}

export interface GeneratedImage {
  buffer: Buffer;
  contentType: string;
}

/** Free, keyless AI image generation via Pollinations. Callers must check isPromptSafe() first. */
export async function generateImage(prompt: string, seed = Math.floor(Math.random() * 1_000_000)): Promise<GeneratedImage> {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pollinations request failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType: res.headers.get('content-type') ?? 'image/png' };
}
