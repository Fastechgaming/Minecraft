import { GoogleGenerativeAI, type Content } from '@google/generative-ai';
import { createLogger } from '../services/logger';

const log = createLogger('gemini');

let client: GoogleGenerativeAI | undefined;
function getClient(): GoogleGenerativeAI {
  if (!client) client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
  return client;
}

export async function chatReply(history: Content[], prompt: string, systemInstruction: string): Promise<string> {
  const model = getClient().getGenerativeModel({
    model: process.env.GEMINI_CHAT_MODEL ?? 'gemini-3.5-flash-lite',
    systemInstruction
  });
  const chat = model.startChat({ history });
  const result = await chat.sendMessage(prompt);
  return result.response.text();
}

export interface ScamScanResult {
  isScam: boolean;
  confidence: number;
  reason: string;
}

/**
 * Downloads an image and asks Gemini Vision to classify it as a crypto/nitro
 * scam, phishing screenshot, or malicious QR code. Fails closed (not a scam)
 * on any error so a flaky API call never causes a false auto-punish.
 */
export async function analyzeImageForScam(imageUrl: string): Promise<ScamScanResult> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return { isScam: false, confidence: 0, reason: 'download failed' };
    const contentType = res.headers.get('content-type') ?? 'image/png';
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > 8 * 1024 * 1024) return { isScam: false, confidence: 0, reason: 'image too large' };

    const model = getClient().getGenerativeModel({ model: process.env.GEMINI_VISION_MODEL ?? 'gemini-3.5-flash-lite' });
    const result = await model.generateContent([
      {
        text:
          'You are a Discord anti-scam filter. Look at this image and decide if it is a crypto scam, fake Discord Nitro giveaway, phishing screenshot, or malicious QR code. ' +
          'Respond with STRICT JSON only, no markdown: {"isScam": boolean, "confidence": number (0 to 1), "reason": "short reason"}.'
      },
      { inlineData: { mimeType: contentType, data: buffer.toString('base64') } }
    ]);
    const text = result.response.text().trim().replace(/^```json\s*|```$/g, '');
    const parsed = JSON.parse(text) as ScamScanResult;
    return {
      isScam: Boolean(parsed.isScam),
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
      reason: String(parsed.reason ?? '').slice(0, 200)
    };
  } catch (err) {
    log.warn('Scam scan failed, defaulting to not-scam', err);
    return { isScam: false, confidence: 0, reason: 'scan error' };
  }
}
