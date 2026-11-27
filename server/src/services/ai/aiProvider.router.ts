import axios from 'axios';
import { logger } from '../../utils/logger';

export type AiProviderName = 'openai' | 'google' | 'dashscope' | 'nvidia' | 'pollinations';

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

export type AiTask = 'default' | 'classification' | 'copy';

// High-volume, low-stakes jobs (intent detection, templated copy) should try the
// cheapest providers first. Triage/vision/concierge keep the default chain.
const CHEAP_FIRST: AiProviderName[] = ['pollinations', 'dashscope', 'openai', 'nvidia', 'google'];

function providerChain(task: AiTask = 'default'): AiProviderName[] {
  const configured: Record<AiProviderName, boolean> = {
    openai: Boolean(process.env.OPENAI_API_KEY),
    google: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY),
    dashscope: Boolean(process.env.DASHSCOPE_API_KEY),
    nvidia: Boolean(process.env.NVIDIA_API_KEY),
    pollinations: process.env.POLLINATIONS_ENABLED === 'true',
  };
  const order: AiProviderName[] = task === 'default'
    ? ['openai', 'dashscope', 'nvidia', 'pollinations', 'google']
    : CHEAP_FIRST;
  // Gemini is last in both orders: it is unreachable from some Render networks
  // and its 30s timeout would otherwise delay every request that could be
  // served faster.
  return order.filter((name) => configured[name]);
}

export function aiProviderStatus(): Record<AiProviderName, boolean> {
  return {
    openai: Boolean(process.env.OPENAI_API_KEY),
    google: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY),
    dashscope: Boolean(process.env.DASHSCOPE_API_KEY),
    nvidia: Boolean(process.env.NVIDIA_API_KEY),
    pollinations: process.env.POLLINATIONS_ENABLED === 'true',
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

async function openAiCompatibleJson(
  opts: { apiKey: string; baseURL: string; model: string },
  prompt: string,
  schema: JsonSchema,
  system?: string,
): Promise<string> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({
    apiKey: opts.apiKey,
    baseURL: opts.baseURL,
    timeout: 20_000,
    maxRetries: 0,
  });
  const response = await client.chat.completions.create({
    model: opts.model,
    temperature: 0,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  } as any);
  return response.choices?.[0]?.message?.content ?? '';
}

async function openAiCompatibleText(
  opts: { apiKey: string; baseURL: string; model: string },
  prompt: string,
  system?: string,
): Promise<string> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({
    apiKey: opts.apiKey,
    baseURL: opts.baseURL,
    timeout: 20_000,
    maxRetries: 0,
  });
  const response = await client.chat.completions.create({
    model: opts.model,
    temperature: 0.2,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: prompt },
    ],
  } as any);
  return response.choices?.[0]?.message?.content ?? '';
}

function nvidiaOpts() {
  return {
    apiKey: process.env.NVIDIA_API_KEY || '',
    baseURL: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
    model: process.env.NVIDIA_MODEL || 'deepseek-ai/deepseek-v4.1-flash',
  };
}

function pollinationsOpts() {
  return {
    apiKey: 'pollinations',
    baseURL: process.env.POLLINATIONS_BASE_URL || 'https://text.pollinations.ai/openai',
    model: process.env.POLLINATIONS_MODEL || 'gpt-oss-20b',
  };
}

export function nvidiaModelList(): string[] {
  const single = (process.env.NVIDIA_MODEL || '').trim();
  if (single && single !== 'auto') return [single];
  const raw =
    process.env.NVIDIA_MODELS ||
    'moonshotai/kimi-k3.1-pro,z-ai/glm-5.3-flash,minimaxai/minimax-m3.1-flash,google/gemma-4-31b-it,nvidia/nemotron-3.5-lightning-30b-a3b,nvidia/nemotron-3-ultra-550b-a55b,stepfun-ai/step-5-preview';
  return raw
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
}

function isAuthError(error: any): boolean {
  return error?.status === 401 || error?.status === 403 || /(401|403)/.test(String(error?.message));
}

async function nvidiaJson(prompt: string, schema: JsonSchema, system?: string): Promise<string> {
  const opts = nvidiaOpts();
  let lastError: any;
  for (const model of nvidiaModelList()) {
    try {
      return await openAiCompatibleJson({ ...opts, model }, prompt, schema, system);
    } catch (error) {
      if (isAuthError(error)) throw error;
      lastError = error;
    }
  }
  throw lastError || new Error('No NVIDIA model available');
}

async function nvidiaText(prompt: string, system?: string): Promise<string> {
  const opts = nvidiaOpts();
  let lastError: any;
  for (const model of nvidiaModelList()) {
    try {
      return await openAiCompatibleText({ ...opts, model }, prompt, system);
    } catch (error) {
      if (isAuthError(error)) throw error;
      lastError = error;
    }
  }
  throw lastError || new Error('No NVIDIA model available');
}

async function pollinationsJson(prompt: string, schema: JsonSchema, system?: string): Promise<string> {
  return openAiCompatibleJson(pollinationsOpts(), prompt, schema, system);
}

async function pollinationsText(prompt: string, system?: string): Promise<string> {
  return openAiCompatibleText(pollinationsOpts(), prompt, system);
}

async function runJson(
  provider: AiProviderName,
  prompt: string,
  schema: JsonSchema,
  system?: string,
): Promise<string> {
  switch (provider) {
    case 'openai':
      return openAiJson(prompt, schema, system);
    case 'google':
      return googleJson(prompt, schema, system);
    case 'dashscope':
      return dashscopeJson(prompt, schema, system);
    case 'nvidia':
      return nvidiaJson(prompt, schema, system);
    case 'pollinations':
      return pollinationsJson(prompt, schema, system);
  }
}

async function runText(provider: AiProviderName, prompt: string, system?: string): Promise<string> {
  switch (provider) {
    case 'openai':
      return openAiText(prompt, system);
    case 'google':
      return googleText(prompt, system);
    case 'dashscope':
      return dashscopeText(prompt, system);
    case 'nvidia':
      return nvidiaText(prompt, system);
    case 'pollinations':
      return pollinationsText(prompt, system);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
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
  const result = await withTimeout(model.generateContent(prompt), 30_000, 'googleJson');
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
  const result = await withTimeout(model.generateContent(prompt), 30_000, 'googleText');
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

const PROVIDER_COOLDOWN_MS = 60_000;
const MAX_PROVIDER_ATTEMPT_MS = 20_000;

function routerDeadline(): number {
  const configured = Number(process.env.AI_ROUTER_TIMEOUT_MS);
  return Date.now() + (Number.isFinite(configured) && configured > 0 ? configured : 30_000);
}

export class AiProviderRouter {
  private lastErrors: Partial<Record<AiProviderName, string>> = {};
  /** Failed providers sit out a minute so a dead provider cannot add latency
   *  to every request in the fallback chain. */
  private cooldownUntil: Partial<Record<AiProviderName, number>> = {};

  getStatus() {
    return aiProviderStatus();
  }

  getLastError() {
    return { ...this.lastErrors };
  }

  private recordFailure(provider: AiProviderName, message: string) {
    this.lastErrors[provider] = message;
    this.cooldownUntil[provider] = Date.now() + PROVIDER_COOLDOWN_MS;
    logger.warn(`[AiRouter] ${provider} failed: ${message}`);
  }

  private chainFor(options: { provider?: AiProviderName; task?: AiTask }): AiProviderName[] {
    return options.provider ? [options.provider] : providerChain(options.task);
  }

  async generateJson<T>(
    prompt: string,
    schema: JsonSchema,
    options: { system?: string; provider?: AiProviderName; task?: AiTask } = {},
  ): Promise<AiRouterJsonResult<T> | null> {
    const deadline = routerDeadline();
    for (const provider of this.chainFor(options)) {
      if (!options.provider && (this.cooldownUntil[provider] ?? 0) > Date.now()) continue;
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        this.lastErrors[provider] = 'router deadline exceeded';
        break;
      }
      try {
        const raw = await withTimeout(
          runJson(provider, prompt, schema, options.system),
          Math.min(remaining, MAX_PROVIDER_ATTEMPT_MS),
          `ai:${provider}`,
        );
        if (!raw) {
          this.lastErrors[provider] = 'provider returned an empty response';
          continue;
        }
        const parsed = JSON.parse(extractJson(raw)) as T;
        delete this.cooldownUntil[provider];
        return { data: parsed, provider, raw };
      } catch (error) {
        this.recordFailure(provider, error instanceof Error ? error.message : String(error));
      }
    }
    return null;
  }

  async generateText(
    prompt: string,
    options: { system?: string; provider?: AiProviderName; task?: AiTask } = {},
  ): Promise<AiRouterTextResult | null> {
    const deadline = routerDeadline();
    for (const provider of this.chainFor(options)) {
      if (!options.provider && (this.cooldownUntil[provider] ?? 0) > Date.now()) continue;
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        this.lastErrors[provider] = 'router deadline exceeded';
        break;
      }
      try {
        const text = await withTimeout(
          runText(provider, prompt, options.system),
          Math.min(remaining, MAX_PROVIDER_ATTEMPT_MS),
          `ai:${provider}`,
        );
        if (text) {
          delete this.cooldownUntil[provider];
          return { text, provider };
        }
        this.lastErrors[provider] = 'provider returned an empty response';
      } catch (error) {
        this.recordFailure(provider, error instanceof Error ? error.message : String(error));
      }
    }
    return null;
  }
}

export const aiProviderRouter = new AiProviderRouter();
