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
export declare class OpenWAFaqBotService {
    evaluateMessage(message: string, businessRules?: FaqRule[] | null): string | null;
    private detectPlugin;
    private parseRules;
    private matchRule;
}
export declare const openwaFaqBotService: OpenWAFaqBotService;
//# sourceMappingURL=openwa.faq-bot.service.d.ts.map