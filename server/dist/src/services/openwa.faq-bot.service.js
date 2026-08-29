"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openwaFaqBotService = exports.OpenWAFaqBotService = void 0;
const openwa_plugins_service_1 = require("./openwa.plugins.service");
class OpenWAFaqBotService {
    evaluateMessage(message, businessRules) {
        try {
            if (businessRules && businessRules.length > 0) {
                const match = this.matchRule(businessRules, message);
                if (match)
                    return match.reply;
            }
        }
        catch {
            // ignore malformed business FAQ rules
        }
        const plugin = this.detectPlugin();
        if (!plugin)
            return null;
        try {
            const rules = this.parseRules(plugin.description || plugin.repoPath || '');
            const match = this.matchRule(rules, message);
            if (match)
                return match.reply;
        }
        catch {
            // ignore malformed plugin FAQ example
        }
        return null;
    }
    detectPlugin() {
        const catalog = (0, openwa_plugins_service_1.getPluginCatalog)();
        const matched = (0, openwa_plugins_service_1.findPluginsByKeywords)(['faq', 'auto-reply', 'support'], catalog);
        return matched[0] || null;
    }
    parseRules(raw) {
        const normalized = raw
            .replace(/\\n/g, ' ')
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'")
            .replace(/\{pattern:/g, '{"pattern":')
            .replace(/\{mode:/g, '{"mode":');
        if (!normalized.trim())
            return [];
        let rules = [];
        try {
            const parsed = JSON.parse(normalized);
            if (Array.isArray(parsed)) {
                rules = parsed.filter((item) => item && typeof item === 'object' && 'pattern' in item && 'reply' in item);
            }
        }
        catch {
            try {
                const cleaned = normalized.replace(/^\[/g, '').replace(/\]$/g, '').trim();
                const json = JSON.parse(cleaned);
                if (json && typeof json === 'object' && 'pattern' in json && 'reply' in json) {
                    rules = [json];
                }
            }
            catch {
                return [];
            }
        }
        return rules.map(rule => ({
            mode: rule.mode || 'contains',
            pattern: rule.pattern,
            reply: rule.reply,
        }));
    }
    matchRule(rules, message) {
        const normalized = message.trim().toLowerCase();
        for (const rule of rules) {
            if (!rule.pattern || !rule.reply)
                continue;
            if (rule.mode === 'exact' && normalized === rule.pattern.toLowerCase()) {
                return rule;
            }
            if (rule.mode === 'regex') {
                try {
                    const regex = new RegExp(rule.pattern, 'i');
                    if (regex.test(message)) {
                        return rule;
                    }
                }
                catch {
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
exports.OpenWAFaqBotService = OpenWAFaqBotService;
exports.openwaFaqBotService = new OpenWAFaqBotService();
//# sourceMappingURL=openwa.faq-bot.service.js.map