export declare class DashscopeService {
    /**
     * Implementation of Alibaba Cloud DashScope (Qwen) API call for Trust Profiles.
     * Falls back to a heuristic algorithm if the API key is missing or fails.
     */
    generateTrustProfile(userId: string): Promise<string>;
    /**
     * Helper to perform generic text generation using Alibaba Cloud Qwen AI model.
     */
    generateText(systemPrompt: string, userPrompt: string): Promise<string>;
}
export declare const dashscopeService: DashscopeService;
//# sourceMappingURL=dashscope.service.d.ts.map