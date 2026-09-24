/**
 * PabandiTrustMCPServer
 *
 * This module acts as the scaffolding for Pabandi to act as a Model Context Protocol (MCP) Server.
 * Instead of only consuming OSINT, Pabandi produces privacy-preserving intelligence.
 *
 * Other platforms can connect to this MCP to verify a user's trust reliability
 * without exposing their exact score or financial data (via TrustVeil).
 */
export declare class PabandiTrustMCPServer {
    /**
     * Initialize the MCP Server (e.g. using @modelcontextprotocol/sdk Server class in production)
     */
    startServer(port?: number): void;
    /**
     * MCP Tool Implementation: queryPTPAttestation
     * Exposes the formal Pabandi Trust Protocol (PTP) attestation to MCP clients.
     */
    handleQueryPTPAttestation(args: {
        userId: string;
        entityType: 'INDIVIDUAL' | 'BUSINESS';
    }): Promise<{
        _meta: {
            type: string;
            version: string;
        };
        attestation: import("../protocol/ptp.spec").PTPAttestation;
    }>;
    /**
     * MCP Tool Implementation: queryTrustVeil
     * Allows an external LLM/Agent to ask if a Pabandi user meets a specific trust threshold.
     */
    handleQueryTrustVeil(args: {
        userId: string;
        targetThreshold: number;
    }): Promise<{
        _meta: {
            type: string;
        };
        verified: boolean;
        trend: string;
    }>;
    /**
     * MCP Tool Implementation: getTrustFluxVelocity
     * Allows an external agent to get the peer-normalized momentum of a user.
     */
    handleGetTrustFluxVelocity(args: {
        userId: string;
    }): Promise<{
        direction: string;
        momentum: number;
    }>;
    /**
     * MCP Tool Implementation: subscribeToZeroDayThreats
     *
     * This is what makes Pabandi "One of a Kind". When Pabandi's Shadow Escrow
     * catches a scammer and extracts their playbook (wallets, domains, IPs),
     * Pabandi broadcasts this intelligence OUTWARD to the MCP ecosystem.
     *
     * Other systems (banks, marketplaces, exchanges) connected to Pabandi's MCP
     * receive this real-time threat feed.
     */
    publishZeroDayThreat(threatData: {
        sourceScammerId: string;
        muleWallets: string[];
        dropDomains: string[];
        tactic: string;
    }): Promise<{
        _meta: {
            type: string;
            publisher: string;
        };
        timestamp: string;
        threatData: {
            sourceScammerId: string;
            muleWallets: string[];
            dropDomains: string[];
            tactic: string;
        };
    }>;
}
export declare const pabandiTrustMCPServer: PabandiTrustMCPServer;
//# sourceMappingURL=trustServer.d.ts.map