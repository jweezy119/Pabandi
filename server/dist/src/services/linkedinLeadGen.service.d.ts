export interface LinkedInPersona {
    id: string;
    name: string;
    title: string;
    industries: string[];
    minConnections: number;
    icebreakerTemplate: string;
    valueProp: string;
}
export declare const LINKEDIN_PERSONAS: LinkedInPersona[];
export declare const CONTENT_TEMPLATES: {
    trustScore: string[];
    revenue: string[];
    socialProof: string[];
};
export interface CapturedLead {
    leadId: string;
    linkedinId: string;
    linkedinName: string;
    linkedinUrl: string;
    email: string;
    persona: string;
    source: 'linkedin-post' | 'linkedin-dm' | 'linkedin-ad';
    consent: boolean;
    capturedAt: number;
}
export declare class LinkedInLeadGenService {
    private leads;
    private connectionRequests;
    private scheduledPosts;
    private profileCache;
    /**
     * Generate a personalized icebreaker message for a LinkedIn prospect.
     * Uses persona templates + dynamic personalization.
     */
    generateIcebreaker(persona: LinkedInPersona, firstName: string, techStack?: string, mutualConnections?: string[]): string;
    /**
     * Generate LinkedIn post content for a specific persona + content type.
     * Uses Sarcastic Desi humor tone for relatability.
     */
    generateLinkedInPost(persona: LinkedInPersona, contentType: keyof typeof CONTENT_TEMPLATES): string;
    /**
     * Schedule a batch of LinkedIn posts for maximum engagement.
     * Posts are staggered across time zones + peak hours.
     */
    scheduleContentBatch(personas: LinkedInPersona[], count?: number, startDate?: Date): Array<{
        content: string;
        persona: string;
        scheduledAt: number;
    }>;
    /**
     * Capture a LinkedIn lead from a post → landing page conversion.
     */
    captureLead(linkedinId: string, linkedinName: string, linkedinUrl: string, email: string, persona: string, source: 'linkedin-post' | 'linkedin-dm' | 'linkedin-ad'): Promise<CapturedLead>;
    /**
     * Send a personalized DM campaign to a list of LinkedIn prospects.
     * Returns success/failure counts.
     */
    runDMCampaign(persona: LinkedInPersona, prospects: Array<{
        linkedinId: string;
        firstName: string;
        techStack?: string;
        mutualConnections?: string[];
    }>): Promise<{
        sent: number;
        failed: number;
        errors: string[];
    }>;
    /**
     * Convert a LinkedIn lead into a Pabandi business owner.
     * Creates a free trial with insurance coverage included.
     */
    convertLead(leadId: string, paymentMethod?: string): Promise<{
        success: boolean;
        businessId: string;
        freeTrialDays: number;
    }>;
    /** Scrape LinkedIn profile data (frugal: public search + cache). */
    scrapeProfile(linkedinUrl: string): Promise<Record<string, any>>;
    /** Generate a role-specific LinkedIn post targeting hiring managers. */
    generateRolePost(roleTitle: string, industry: string, companyName?: string): string;
    /** Run the full auto-funnel: schedule posts → simulate scrape → auto-DM → capture leads. */
    runFullFunnel(personas: LinkedInPersona[], postCount?: number, dmLimit?: number): Promise<{
        postsScheduled: number;
        dmsToSend: number;
        leadsCaptured: number;
        errors: string[];
    }>;
    /** Get lead-gen stats */
    getStats(): {
        totalLeads: number;
        byPersona: Record<string, number>;
        conversionRate: number;
        scheduledPosts: number;
        pendingDMs: number;
        cachedProfiles: number;
    };
    private sleep;
}
export declare const linkedinLeadGenService: LinkedInLeadGenService;
//# sourceMappingURL=linkedinLeadGen.service.d.ts.map