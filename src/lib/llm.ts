import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

function getLLMClient(): Anthropic {
  if (client) return client;

  const baseURL = process.env.ANTHROPIC_BASE_URL;
  const apiKey = process.env.ANTHROPIC_AUTH_TOKEN;

  if (!apiKey) {
    throw new Error('ANTHROPIC_AUTH_TOKEN is not set');
  }

  client = new Anthropic({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });

  return client;
}

export type LLMContentBlock = Anthropic.ContentBlockParam;

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | LLMContentBlock[];
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function callLLM(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<string> {
  const anthropic = getLLMClient();
  const model = options.model || process.env.ANTHROPIC_MODEL || 'mimo-v2.5-pro';
  const temperature = options.temperature ?? 0.3;
  const maxTokens = options.maxTokens ?? 4096;

  // Extract system message if present
  const systemMsg = messages.find(m => m.role === 'system');
  const nonSystemMessages = messages.filter(m => m.role !== 'system');

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system: systemMsg?.content as string || undefined,
    messages: nonSystemMessages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  });

  const textBlock = response.content.find(b => b.type === 'text');
  return textBlock?.text || '';
}
