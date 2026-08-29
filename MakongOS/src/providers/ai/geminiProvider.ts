import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import type { AIProvider, ChatOptions, ImageGenerationOptions, ModerationClassification } from './types';
import { createLogger } from '../../services/logger';

const log = createLogger('gemini');

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
  return new GoogleGenerativeAI(apiKey);
}

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
];

async function urlToInlineData(url: string): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(url);
  const buffer = Buffer.from(await res.arrayBuffer());
  const mimeType = res.headers.get('content-type') ?? 'image/png';
  return { data: buffer.toString('base64'), mimeType };
}

export const geminiProvider: AIProvider = {
  name: 'gemini',

  async chat(options: ChatOptions): Promise<string> {
    const client = getClient();
    const model = client.getGenerativeModel({
      model: process.env.GEMINI_CHAT_MODEL ?? 'gemini-3.5-flash-lite',
      systemInstruction: options.systemPrompt,
      safetySettings: SAFETY_SETTINGS
    });

    const history = options.history.map((m) => ({
      role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: m.content }]
    }));

    const chat = model.startChat({ history });

    const parts: ({ text: string } | { inlineData: { data: string; mimeType: string } })[] = [{ text: options.userMessage }];
    if (options.imageUrls?.length) {
      for (const url of options.imageUrls.slice(0, 3)) {
        try {
          parts.push({ inlineData: await urlToInlineData(url) });
        } catch (err) {
          log.warn('Failed to fetch image for AI context', err);
        }
      }
    }

    const result = await chat.sendMessage(parts as never);
    return result.response.text().trim();
  },

  async classifyModeration(text: string): Promise<ModerationClassification> {
    const client = getClient();
    const model = client.getGenerativeModel({
      model: process.env.GEMINI_CHAT_MODEL ?? 'gemini-3.5-flash-lite',
      generationConfig: { responseMimeType: 'application/json' }
    });

    const prompt = `You are a Discord moderation classifier. Classify the following message for rule violations.
Categories: none, spam, harassment, hate, threat, nsfw, scam, advertising, excessive_mentions, toxicity.
Respond ONLY with JSON: {"category": string, "confidence": number between 0 and 1, "explanation": string}.

Message: """${text}"""`;

    try {
      const result = await model.generateContent(prompt);
      const parsed = JSON.parse(result.response.text()) as ModerationClassification;
      return {
        category: parsed.category ?? 'none',
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
        explanation: parsed.explanation ?? ''
      };
    } catch (err) {
      log.error('Moderation classification failed', err);
      return { category: 'none', confidence: 0, explanation: 'classification failed' };
    }
  },

  async analyzeImage(imageUrl: string, prompt: string): Promise<string> {
    const client = getClient();
    const model = client.getGenerativeModel({ model: process.env.GEMINI_VISION_MODEL ?? 'gemini-3.5-flash-lite' });
    const inline = await urlToInlineData(imageUrl);
    const result = await model.generateContent([{ text: prompt }, { inlineData: inline }]);
    return result.response.text().trim();
  },

  async generateImage(options: ImageGenerationOptions): Promise<Buffer> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
    const model = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-3.1-flash-image';

    const prompt = options.negativePrompt ? `${options.prompt}. Avoid: ${options.negativePrompt}` : options.prompt;

    // Image-capable Gemini models ("Nano Banana") generate images through the
    // normal generateContent endpoint with responseModalities including
    // IMAGE — the separate Imagen `:predict` endpoint only accepts Vertex AI
    // OAuth credentials, not a plain Gemini API key, which is why that
    // approach 404s/403s here.
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
      })
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gemini image generation failed (${res.status}): ${body}`);
    }

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[];
    };
    const parts = json.candidates?.[0]?.content?.parts ?? [];
    const b64 = parts.map((p) => p.inlineData?.data).find((data): data is string => !!data);
    if (!b64) throw new Error('Gemini image generation returned no image data');
    return Buffer.from(b64, 'base64');
  }
};
