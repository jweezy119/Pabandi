import axios from 'axios';
import { logger } from '../../utils/logger';

export type AiProviderName = 'openai' | 'google' | 'dashscope';

export interface JsonSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface AiRouterJsonResult<T> {
  data: T;
  provider: AiProviderName;
  raw: string;
}

export interface AiRouterTextResult {
  text: string;
  provider: AiProviderName;
}

interface ProviderAttempt {
  provider: AiProviderName;
  run: () => Promise<string>;
}

function providerChain(): AiProviderName[] {
  const chain: AiProviderName[] = [];
  if (process.env.OPENAI_API_KEY) chain.push('openai');
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY) chain.push('google');
  if (process.env.DASHSCOPE_API_KEY) chain.push('dashscope');
  return chain;
}

export function aiProviderStatus(): Record<AiProviderName, boolean> {
  return {
    openai: Boolean(process.env.OPENAI_API_KEY),
    google: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY),
    dashscope: Boolean(process.env.DASHSCOPE_API_KEY),
  };
}

function extractJson(raw: string): string {
  const trimmed = raw.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return trimmed;
  return trimmed.slice(start, end + 1);
}

async function openAiJson(prompt: string, schema: JsonSchema, system?: string): Promise<string> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  } as any);
  return response.choices?.[0]?.message?.content ?? '';
}

async function googleJson(prompt: string, schema: JsonSchema, system?: string): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
  const genAi = new GoogleGenerativeAI(apiKey);
  const model = genAi.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: schema as any,
    },
    ...(system ? { systemInstruction: system } : {}),
  });
  const result = await model.generateContent(prompt);
  return result.response?.text() ?? '';
}

async function dashscopeJson(prompt: string, _schema: JsonSchema, system?: string): Promise<string> {
  const base = (process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com').replace(/\/$/, '');
  const response = await axios.post(
    `${base}/api/v1/services/aigc/text-generation/generation`,
    {
      model: process.env.DASHSCOPE_MODEL || 'qwen-turbo',
      input: {
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt },
        ],
      },
      parameters: {
        result_format: 'message',
        response_format: { type: 'json_object' },
        temperature: 0,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    },
  );
  return response.data?.output?.choices?.[0]?.message?.content ?? '';
}

async function openAiText(prompt: string, system?: string): Promise<string> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.2,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: prompt },
    ],
  } as any);
  return response.choices?.[0]?.message?.content ?? '';
}

async function googleText(prompt: string, system?: string): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
  const genAi = new GoogleGenerativeAI(apiKey);
  const model = genAi.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    ...(system ? { systemInstruction: system } : {}),
  });
  const result = await model.generateContent(prompt);
  return result.response?.text() ?? '';
}

async function dashscopeText(prompt: string, system?: string): Promise<string> {
  const base = (process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com').replace(/\/$/, '');
  const response = await axios.post(
    `${base}/api/v1/services/aigc/text-generation/generation`,
    {
      model: process.env.DASHSCOPE_MODEL || 'qwen-turbo',
      input: {
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt },
        ],
      },
      parameters: { result_format: 'message', temperature: 0.2 },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    },
  );
  return response.data?.output?.choices?.[0]?.message?.content ?? '';
}

export class AiProviderRouter {
  private lastErrors: Partial<Record<AiProviderName, string>> = {};

  getStatus() {
    return aiProviderStatus();
  }

  getLastError() {
    return { ...this.lastErrors };
  }

  async generateJson<T>(
    prompt: string,
    schema: JsonSchema,
    options: { system?: string; provider?: AiProviderName } = {},
  ): Promise<AiRouterJsonResult<T> | null> {
    const chain = options.provider ? [options.provider] : providerChain();
    for (const provider of chain) {
      try {
        const raw =
          provider === 'openai'
            ? await openAiJson(prompt, schema, options.system)
            : provider === 'google'
              ? await googleJson(prompt, schema, options.system)
              : await dashscopeJson(prompt, schema, options.system);
        if (!raw) {
          this.lastErrors[provider] = 'provider returned an empty response';
          continue;
        }
        const parsed = JSON.parse(extractJson(raw)) as T;
        return { data: parsed, provider, raw };
      } catch (error) {
        this.lastErrors[provider] = error instanceof Error ? error.message : String(error);
        logger.warn(`[AiRouter] ${provider} JSON generation failed:`, this.lastErrors[provider]);
      }
    }
    return null;
  }

  async generateText(
    prompt: string,
    options: { system?: string; provider?: AiProviderName } = {},
  ): Promise<AiRouterTextResult | null> {
    const chain = options.provider ? [options.provider] : providerChain();
    for (const provider of chain) {
      try {
        const text =
          provider === 'openai'
            ? await openAiText(prompt, options.system)
            : provider === 'google'
              ? await googleText(prompt, options.system)
              : await dashscopeText(prompt, options.system);
        if (text) return { text, provider };
        this.lastErrors[provider] = 'provider returned an empty response';
      } catch (error) {
        this.lastErrors[provider] = error instanceof Error ? error.message : String(error);
        logger.warn(`[AiRouter] ${provider} text generation failed:`, this.lastErrors[provider]);
      }
    }
    return null;
  }
}

export const aiProviderRouter = new AiProviderRouter();
