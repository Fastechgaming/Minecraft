export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  imageUrls?: string[];
}

export interface ChatOptions {
  systemPrompt: string;
  history: ChatMessage[];
  userMessage: string;
  imageUrls?: string[];
}

export interface ModerationClassification {
  /** e.g. spam, harassment, hate, threat, nsfw, scam, advertising, none */
  category: string;
  confidence: number; // 0-1
  explanation: string;
}

export interface ImageGenerationOptions {
  prompt: string;
  size?: '256x256' | '512x512' | '1024x1024';
  style?: string;
  negativePrompt?: string;
}

export interface AIProvider {
  name: string;
  chat(options: ChatOptions): Promise<string>;
  classifyModeration(text: string): Promise<ModerationClassification>;
  analyzeImage(imageUrl: string, prompt: string): Promise<string>;
  generateImage(options: ImageGenerationOptions): Promise<Buffer>;
}
