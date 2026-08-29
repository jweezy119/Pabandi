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
declare class AiNlpService {
    getEnabledModels(): string[];
    classifyIntentAndLanguage(message: string): Promise<ClassificationResult>;
    localFallback(message: string): ClassificationResult | null;
    extractBookingEntities(message: string): Promise<BookingEntities>;
    generateCopy(template: string, contextVars: Record<string, any>): Promise<string>;
}
export declare const aiNlpService: AiNlpService;
export {};
//# sourceMappingURL=ai.nlp.service.d.ts.map