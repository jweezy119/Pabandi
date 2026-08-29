import { OpenWAMessageSendResult } from './openwa.service';
export interface TemplateVariable {
    key: string;
    label: string;
    required: boolean;
    example?: string;
}
export interface PabandiTemplate {
    name: string;
    category: 'booking' | 'reminder' | 'notification' | 'marketing' | 'support';
    body: string;
    variables: TemplateVariable[];
    footer?: string;
}
export declare class OpenWATemplateService {
    /**
     * List all available template definitions.
     */
    listTemplates(): PabandiTemplate[];
    /**
     * Get a single template by name.
     */
    getTemplate(name: string): PabandiTemplate | null;
    /**
     * Render a template with the given variables. Returns the final message string.
     */
    render(templateName: string, variables: Record<string, string>): string;
    /**
     * Render and send a template message to a phone number.
     */
    sendTemplate(toPhone: string, templateName: string, variables: Record<string, string>, options?: {
        sessionId?: string;
    }): Promise<OpenWAMessageSendResult>;
}
export declare const openwaTemplateService: OpenWATemplateService;
//# sourceMappingURL=openwa.template.service.d.ts.map