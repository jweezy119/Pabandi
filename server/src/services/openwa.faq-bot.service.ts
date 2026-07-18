import { getPluginCatalog, findPluginsByKeywords } from './openwa.plugins.service';

export interface FaqRule {
  mode: 'contains' | 'exact' | 'regex';
  pattern: string;
  reply: string;
}

export interface FaqBotConfig {
  rules: FaqRule[];
  fallbackReply: string;
  fallbackCooldownSec: number;
  respondInGroups: boolean;
}

export class OpenWAFaqBotService {
  evaluateMessage(message: string, businessRules?: FaqRule[] | null): string | null {
    try {
      if (businessRules && businessRules.length > 0) {
        const match = this.matchRule(businessRules, message);
        if (match) return match.reply;
      }
    } catch {
      // ignore malformed business FAQ rules
    }

    const plugin = this.detectPlugin();
    if (!plugin) return null;

    try {
      const rules = this.parseRules(plugin.description || plugin.repoPath || '');
      const match = this.matchRule(rules, message);
      if (match) return match.reply;
    } catch {
      // ignore malformed plugin FAQ example
    }

    return null;
  }

  private detectPlugin(): { id?: string; description?: string; repoPath?: string } | null {
    const catalog = getPluginCatalog();
    const matched = findPluginsByKeywords(['faq', 'auto-reply', 'support'], catalog);
    return matched[0] || null;
  }

  private parseRules(raw: string): FaqRule[] {
    const normalized = raw
      .replace(/\\n/g, ' ')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\{pattern:/g, '{"pattern":')
      .replace(/\{mode:/g, '{"mode":');

    if (!normalized.trim()) return [];

    let rules: FaqRule[] = [];
    try {
      const parsed = JSON.parse(normalized);
      if (Array.isArray(parsed)) {
        rules = parsed.filter((item): item is FaqRule => item && typeof item === 'object' && 'pattern' in item && 'reply' in item);
      }
    } catch {
      try {
        const cleaned = normalized.replace(/^\[/g, '').replace(/\]$/g, '').trim();
        const json = JSON.parse(cleaned);
        if (json && typeof json === 'object' && 'pattern' in json && 'reply' in json) {
          rules = [json as FaqRule];
        }
      } catch {
        return [];
      }
    }

    return rules.map(rule => ({
      mode: rule.mode || 'contains',
      pattern: rule.pattern,
      reply: rule.reply,
    }));
  }

  private matchRule(rules: FaqRule[], message: string): FaqRule | null {
    const normalized = message.trim().toLowerCase();

    for (const rule of rules) {
      if (!rule.pattern || !rule.reply) continue;

      if (rule.mode === 'exact' && normalized === rule.pattern.toLowerCase()) {
        return rule;
      }

      if (rule.mode === 'regex') {
        try {
          const regex = new RegExp(rule.pattern, 'i');
          if (regex.test(message)) {
            return rule;
          }
        } catch {
          continue;
        }
      }

      if (rule.mode !== 'regex' && normalized.includes(rule.pattern.toLowerCase())) {
        return rule;
      }
    }

    return null;
  }
}

export const openwaFaqBotService = new OpenWAFaqBotService();
