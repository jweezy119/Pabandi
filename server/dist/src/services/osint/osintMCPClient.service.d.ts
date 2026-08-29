export interface MCPInvestigationResult {
    source: string;
    query: string;
    findings: any;
    riskScoreDelta: number;
    isSuspicious: boolean;
}
/**
 * OsintMCPClientService
 * Orchestrates calls to external Model Context Protocol (MCP) servers
 * as defined in the 2026 OSINT architecture.
 */
export declare class OsintMCPClientService {
    /**
     * 1. Maigret MCP - Individual & Identity Fraud
     * Cross-references usernames across social media and forums.
     */
    queryMaigretMCP(username: string): Promise<MCPInvestigationResult>;
    /**
     * 2. OpenRegistry MCP - Corporate & Procurement Fraud
     * Checks business directors, dissolved companies, and registrations.
     */
    queryOpenRegistryMCP(businessName: string): Promise<MCPInvestigationResult>;
    /**
     * 3. Infrastructure Pipeline (WHOIS -> DNS -> VirusTotal -> Shodan)
     * Chains multiple MCPs together to assess a merchant domain.
     */
    queryInfrastructurePipeline(domain: string): Promise<MCPInvestigationResult[]>;
    /**
     * 4. Bright Data MCP - Threat Actor Marketplace Monitoring
     */
    queryBrightDataMCP(keyword: string): Promise<MCPInvestigationResult>;
    /**
     * 5. CourtListener MCP - Civil Litigation & Eviction Checks (Property Vertical)
     */
    queryCourtListenerMCP(name: string, state?: string): Promise<MCPInvestigationResult>;
}
export declare const osintMCPClient: OsintMCPClientService;
//# sourceMappingURL=osintMCPClient.service.d.ts.map