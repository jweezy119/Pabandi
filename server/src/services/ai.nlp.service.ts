import { logger } from '../utils/logger';
import { aiProviderRouter } from './ai/aiProvider.router';

export type Intent = 'booking' | 'support' | 'cancellation' | 'general' | 'sales' | 'book_table' | 'check_menu' | 'ask_question';

export interface BookingEntities {
  intent: 'book_table' | 'check_menu' | 'ask_question' | 'cancel' | 'reschedule' | 'update' | 'status' | 'pay' | 'hours' | 'human' | 'faq' | 'general';
  partySize?: number;
  date?: string;
  time?: string;
  occasion?: string;
  raw: Record<string, any>;
}

export interface ClassificationResult {
  intent: Intent;
  language: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
}

const CLASSIFICATION_SCHEMA = {
  type: 'object',
  properties: {
    intent: {
      type: 'string',
      enum: ['booking', 'support', 'cancellation', 'general', 'sales', 'book_table', 'check_menu', 'ask_question'],
    },
    language: { type: 'string', description: 'ISO 639-1 language code' },
    sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['intent', 'language', 'sentiment', 'confidence'],
  additionalProperties: false,
} as const;

function classifyDirect(lower: string): Intent | null {
  if (/^(menu|help|start|options|\?|main)$/.test(lower)) return 'general';
  if (/^(cancel|cancel my booking|cancel reservation)$/.test(lower)) return 'cancellation';
  if (/\b(book|reserve|appointment|table for|reservation for|want to book)\b/.test(lower)) return 'booking';
  if (/\b(sales|buy|order|catalog|drop|product)\b/.test(lower)) return 'sales';
  if (/\b(reschedule|change date|move booking|new date|another day|shift my booking)\b/.test(lower)) return 'booking';
  if (/\b(status|my booking|my reservation|upcoming|when is my)\b/.test(lower)) return 'general';
  if (/\b(support|human|agent|talk to someone|escalate|operator)\b/.test(lower)) return 'support';
  return null;
}

function extractBookingEntities(message: string): BookingEntities {
  const lower = message.toLowerCase();
  const raw: Record<string, any> = { message, lower };

  const dateMatch = lower.match(/\b(today|tomorrow|day after tomorrow|\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?)\b/);
  if (dateMatch) raw.dateHint = dateMatch[0];

  const timeMatch = lower.match(/\b(\d{1,2}(?:[:\.]\d{2})?\s?(?:am|pm)?)\b/);
  if (timeMatch) raw.timeHint = timeMatch[0];

  const guestsMatch = lower.match(/\b(\d{1,2})\s*(?:guests?|people|pax|persons?|covers?)\b/);
  const partySize = guestsMatch ? parseInt(guestsMatch[1], 10) : undefined;

  const occasionMatch = lower.match(/\b(birthday|anniversary|date night?|business|corporate|honeymoon)\b/);
  if (occasionMatch) raw.occasion = occasionMatch[0];

  let intent: BookingEntities['intent'] = 'general';
  if (/\b(book|reserve|appointment|table for|reservation for|want to book)\b/.test(lower)) intent = 'book_table';
  else if (/\b(cancel|cancel my booking|cancel reservation)\b/.test(lower)) intent = 'cancel';
  else if (/\b(reschedule|change date|move booking|new date)\b/.test(lower)) intent = 'reschedule';
  else if (/\b(menu|food|drink|order food|dishes)\b/.test(lower)) intent = 'check_menu';
  else if (/\b(hours?|open|clos(e|ing)|timing)\b/.test(lower)) intent = 'hours';
  else if (/\b(help|human|agent|talk to someone)\b/.test(lower)) intent = 'human';
  else if (/\b(faq|questions|refund|deposit|no-show|parking)\b/.test(lower)) intent = 'faq';

  return {
    intent,
    partySize,
    date: dateMatch ? dateMatch[0] : undefined,
    time: timeMatch ? timeMatch[0] : undefined,
    occasion: occasionMatch ? occasionMatch[0] : undefined,
    raw,
  };
}

const MAX_MESSAGE_LENGTH = 2000;

const INJECTION_PATTERNS = [
  /(ignore\s+(all|previous|above)\s+(instructions|rules|commands|directions))/gi,
  /(forget\s+(all|previous|above)\s+(instructions|rules|commands))/gi,
  /(you\s+are\s+now\s+(a|an)\s+\w+\s+that)/gi,
  /(pretend\s+(you|to|that))/gi,
  /(override\s+(all|previous|system))/gi,
  /(new\s+instructions|new\s+role|new\s+persona)/gi,
  /^\s*(system|assistant|user)\s*:/mi,
];

function validateAndSanitizeInput(message: string): { clean: string; blocked: boolean; reason?: string } {
  const trimmed = message.trim();

  if (!trimmed) {
    return { clean: '', blocked: true, reason: 'Empty message' };
  }

  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return {
      clean: trimmed.substring(0, MAX_MESSAGE_LENGTH),
      blocked: false,
      reason: `Message truncated from ${trimmed.length} to ${MAX_MESSAGE_LENGTH} characters`,
    };
  }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      logger.warn('[AI NLP] Potential prompt injection detected', {
        pattern: pattern.source.substring(0, 80),
        messageLength: trimmed.length,
      });
      return {
        clean: trimmed,
        blocked: true,
        reason: 'Input contains potentially unsafe patterns',
      };
    }
  }

  return { clean: trimmed, blocked: false };
}

function validateClassificationOutput(data: any): data is ClassificationResult {
  if (!data || typeof data !== 'object') return false;
  if (!['booking', 'support', 'cancellation', 'general', 'sales', 'book_table', 'check_menu', 'ask_question'].includes(data.intent)) return false;
  if (typeof data.language !== 'string' || data.language.length !== 2) return false;
  if (!['positive', 'neutral', 'negative'].includes(data.sentiment)) return false;
  if (typeof data.confidence !== 'number' || data.confidence < 0 || data.confidence > 1) return false;
  return true;
}

function fallbackClassification(message: string): ClassificationResult {
  const lower = message.toLowerCase();
  const direct = classifyDirect(lower);
  if (direct) {
    return {
      intent: direct,
      language: /[\u0600-\u06FF]/.test(lower) ? 'ur' : 'en',
      sentiment: 'neutral',
      confidence: 0.7,
    };
  }

  const entities = extractBookingEntities(lower);
  return {
    intent: entities.intent === 'book_table' ? 'booking' : entities.intent === 'check_menu' || entities.intent === 'ask_question' ? 'support' : 'general',
    language: /[\u0600-\u06FF]/.test(lower) ? 'ur' : 'en',
    sentiment: 'neutral',
    confidence: 0.4,
  };
}

class AiNlpService {
  getEnabledModels(): string[] {
    const status = aiProviderRouter.getStatus();
    return [
      ...(status.openai ? [process.env.OPENAI_MODEL || 'gpt-4o-mini'] : []),
      ...(status.google ? [process.env.GEMINI_MODEL || 'gemini-3.8-flash'] : []),
      ...(status.dashscope ? [process.env.DASHSCOPE_MODEL || 'qwen-turbo'] : []),
    ];
  }

  async classifyIntentAndLanguage(message: string): Promise<ClassificationResult> {
    const validation = validateAndSanitizeInput(message);
    if (validation.blocked) {
      logger.warn('[AI NLP] Input blocked', { reason: validation.reason, messageLength: message.length });
      return { intent: 'general', language: 'en', sentiment: 'neutral', confidence: 0.1 };
    }

    const cleanMessage = validation.clean;
    const system = [
      'You are an intent classification engine.',
      'Classify the user message into the schema provided.',
      'Output only the JSON object. Do not add markdown or explanation.',
    ].join(' ');

    const routed = await aiProviderRouter.generateJson<ClassificationResult>(
      cleanMessage,
      CLASSIFICATION_SCHEMA as any,
      { system },
    );

    if (routed && validateClassificationOutput(routed.data)) {
      logger.info('[AI NLP] Classification result', {
        intent: routed.data.intent,
        language: routed.data.language,
        confidence: routed.data.confidence,
        provider: routed.provider,
      });
      return routed.data;
    }

    return fallbackClassification(cleanMessage);
  }

  localFallback(message: string): ClassificationResult | null {
    const lower = message.toLowerCase();
    const direct = classifyDirect(lower);
    if (direct) return { intent: direct, language: 'en', sentiment: 'neutral', confidence: 0.7 };
    if (/\b(book|reserve|table for|reservation for|want to book)\b/.test(lower)) return { intent: 'booking', language: 'en', sentiment: 'neutral', confidence: 0.7 };
    return null;
  }

  async extractBookingEntities(message: string): Promise<BookingEntities> {
    const validation = validateAndSanitizeInput(message);
    const clean = validation.blocked ? '' : validation.clean;
    return extractBookingEntities(clean || message);
  }

  async generateCopy(template: string, contextVars: Record<string, any>): Promise<string> {
    if (template.length > 500) {
      logger.warn('[AI NLP] Template too long, truncating', { length: template.length });
      template = template.substring(0, 500);
    }

    let contextStr = 'Context Variables:\n';
    for (const [key, value] of Object.entries(contextVars)) {
      const valStr = typeof value === 'string' ? value.substring(0, 200) : JSON.stringify(value);
      contextStr += `- ${key}: ${valStr}\n`;
    }

    const system = [
      'You are a skilled copywriter for Pabandi, a trust and escrow platform.',
      'Use the template and context variables to write a natural conversational reply.',
      'Output only the final message text. Do not add explanations.',
    ].join(' ');

    const prompt = `Template/Instruction: ${template}\n\n${contextStr}`;
    const routed = await aiProviderRouter.generateText(prompt, { system });
    if (routed?.text) return routed.text;

    // No provider answered. Still honour simple {{variable}} templates so a
    // WhatsApp reply is not lost to an AI outage.
    const interpolated = template.replace(
      /\{\{(\w+)\}\}/g,
      (_match, key) => String(contextVars[key] ?? ''),
    );
    return interpolated.trim() || 'Sorry, I am having trouble understanding right now. Please try again or use the app.';
  }
}

export const aiNlpService = new AiNlpService();
