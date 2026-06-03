import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// ============ Provider 1: Anthropic (mimo) ============
let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (anthropicClient) return anthropicClient;
  const baseURL = process.env.ANTHROPIC_BASE_URL;
  const apiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  if (!apiKey) throw new Error('ANTHROPIC_AUTH_TOKEN is not set');
  anthropicClient = new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });
  return anthropicClient;
}

// ============ Provider 2: DashScope / OpenAI-compatible ============
let dashscopeClient: OpenAI | null = null;

function getDashScopeClient(): OpenAI {
  if (dashscopeClient) return dashscopeClient;
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY is not set');
  dashscopeClient = new OpenAI({
    apiKey,
    baseURL: process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  });
  return dashscopeClient;
}

// ============ Types ============
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

// ============ Unified callLLM ============
export async function callLLM(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<string> {
  const provider = process.env.LLM_PROVIDER || 'dashscope';

  if (provider === 'anthropic') {
    return callAnthropic(messages, options);
  } else {
    return callDashScope(messages, options);
  }
}

// Anthropic call
async function callAnthropic(messages: LLMMessage[], options: LLMOptions): Promise<string> {
  const anthropic = getAnthropicClient();
  const model = options.model || process.env.ANTHROPIC_MODEL || 'mimo-v2.5-pro';
  const temperature = options.temperature ?? 0.3;
  const maxTokens = options.maxTokens ?? 4096;

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

// DashScope (OpenAI-compatible) call
async function callDashScope(messages: LLMMessage[], options: LLMOptions): Promise<string> {
  const client = getDashScopeClient();
  const model = options.model || process.env.DASHSCOPE_MODEL || 'deepseek-v3';
  const temperature = options.temperature ?? 0.3;
  const maxTokens = options.maxTokens ?? 4096;

  // Convert to OpenAI message format, preserving image content
  const openaiMessages = messages.map(m => {
    if (m.role === 'system') {
      return { role: 'system' as const, content: m.content as string };
    }
    // Handle image content blocks - convert to OpenAI vision format
    if (Array.isArray(m.content)) {
      const parts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
      for (const block of m.content) {
        if ('text' in block && block.type === 'text') {
          parts.push({ type: 'text', text: (block as { type: string; text: string }).text });
        } else if (block.type === 'image' && 'source' in block) {
          const src = (block as { type: string; source: { type: string; media_type: string; data: string } }).source;
          if (src.type === 'base64') {
            parts.push({
              type: 'image_url',
              image_url: { url: `data:${src.media_type};base64,${src.data}` },
            });
          }
        }
      }
      return { role: m.role as 'user' | 'assistant', content: parts };
    }
    return { role: m.role as 'user' | 'assistant', content: m.content as string };
  });

  const response = await client.chat.completions.create({
    model,
    temperature,
    max_tokens: maxTokens,
    messages: openaiMessages as OpenAI.ChatCompletionMessageParam[],
  });

  return response.choices[0]?.message?.content || '';
}

// ============ Streaming (for Anthropic) ============
export function callLLMStream(
  messages: LLMMessage[],
  options: LLMOptions = {}
): ReadableStream<Uint8Array> {
  const anthropic = getAnthropicClient();
  const model = options.model || process.env.ANTHROPIC_MODEL || 'mimo-v2.5-pro';
  const temperature = options.temperature ?? 0.3;
  const maxTokens = options.maxTokens ?? 4096;

  const systemMsg = messages.find(m => m.role === 'system');
  const nonSystemMessages = messages.filter(m => m.role !== 'system');

  const stream = anthropic.messages.stream({
    model,
    max_tokens: maxTokens,
    temperature,
    system: systemMsg?.content as string || undefined,
    messages: nonSystemMessages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  });

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
