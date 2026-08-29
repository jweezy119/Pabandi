export interface SherlockResult {
    site: string;
    urlUser: string;
    isClaimed: boolean;
    isSuspicious: boolean;
}
export interface PhoneValidationResult {
    phone: string;
    isValid: boolean;
    type: 'fixed_line' | 'mobile' | 'voip' | 'unknown';
    countryCode: string;
    isSuspicious: boolean;
    riskDelta: number;
}
export interface DomainWhoisResult {
    domain: string;
    domainAgeDays: number;
    registrar: string;
    isSuspicious: boolean;
    riskDelta: number;
}
export declare class OsintService {
    /**
     * Run a mock Sherlock username correlation check.
     * In production, this would `exec` the sherlock CLI or call a managed OSINT API.
     */
    runSherlock(username: string): Promise<SherlockResult[]>;
    /**
     * Validate phone number intelligence (AbstractAPI / PhoneInfoga stub).
     * Checks HLR, VOIP status, and geographic mismatch.
     */
    validatePhone(phone: string): Promise<PhoneValidationResult>;
    /**
     * Check business domain age using WhoisXML API stub.
     * Domains < 30 days old are heavily penalized.
     */
    verifyBusinessDomain(domain: string): Promise<DomainWhoisResult>;
    /**
     * Check if sherlock results hit known fraud platforms.
     */
    hasSuspiciousFootprint(sherlockResults: SherlockResult[]): boolean;
    /**
     * TinEye Reverse Image Search Stub
     * Checks if a logo or license is a known stock photo or scam image.
     */
    verifyImageTineye(imageUrl: string): Promise<{
        isSuspicious: boolean;
        matches: number;
    }>;
    /**
     * Identity Clustering Stub
     * Mocks client-side fingerprinting and hashes to catch fraud rings.
     */
    clusterIdentity(userId: string, reqIp: string, reqDeviceStr: string): Promise<{
        id: string;
        riskScore: number;
        deviceHash: string;
        paymentHash: string | null;
        ipHash: string | null;
        userIds: string[];
        detectedAt: Date;
    }>;
    /**
     * ASYNC QUEUE: The main entry point for the "Verify Quietly" workflow.
     * Runs in the background (fire and forget) to evaluate a user/business using the MCP OSINT pipeline.
     */
    queueOSINTChecks(userId: string, businessId?: string): Promise<void>;
}
export declare const osintService: OsintService;
//# sourceMappingURL=osint.service.d.ts.map