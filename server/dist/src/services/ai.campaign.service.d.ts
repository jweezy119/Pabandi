export declare const aiCampaignService: {
    /**
     * Generates promotional copy using AI based on target audience and goal.
     * If a list of leads is provided, it can generate personalized variants or a general broadcast template.
     */
    generateCampaignCopy(businessId: string, targetAudience: string, goal: string, sampleLeadNames?: string[]): Promise<string>;
    /**
     * Find dormant customers who haven't been contacted in a while.
     */
    findDormantLeads(businessId: string, daysDormant?: number): Promise<never[]>;
};
//# sourceMappingURL=ai.campaign.service.d.ts.map