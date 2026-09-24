export type ToolAccess = 'public' | 'owner' | 'verified' | 'exclusive';
export interface PabandiTool {
    name: string;
    short: string;
    description: string;
    access: ToolAccess;
    category: string;
    endpoints: {
        method: string;
        path: string;
        note?: string;
    }[];
    inputs: Record<string, string>;
    output: string;
    exclusiveNote?: string;
    attestation?: string;
}
export declare const pabandiToolsRegistry: PabandiTool[];
declare const accessLabel: Record<ToolAccess, string>;
export { accessLabel };
export declare function pabandiPlatformDoc(): {
    name: string;
    version: string;
    description: string;
    tools: {
        accessLabel: string;
        name: string;
        short: string;
        description: string;
        access: ToolAccess;
        category: string;
        endpoints: {
            method: string;
            path: string;
            note?: string;
        }[];
        inputs: Record<string, string>;
        output: string;
        exclusiveNote?: string;
        attestation?: string;
    }[];
    accessTiers: {
        public: string;
        owner: string;
        verified: string;
        exclusive: string;
    };
    specUrl: string;
    toolsUrl: string;
    ptp: {
        verifyEndpoint: string;
        publicKeyEndpoint: string;
        issueEndpoint: string;
        ledgerEndpoint: string;
    };
    mcp: {
        endpoint: string;
        protocol: string;
        tools: {
            name: string;
            description: string;
            access: ToolAccess;
            category: string;
            endpoints: {
                method: string;
                path: string;
                note?: string;
            }[];
        }[];
    };
    sdk: {
        baseUrl: string;
        auth: string;
        examples: {
            search: string;
            hospitalityBook: string;
            connectFinance: string;
            predictive: string;
            zkRealestate: string;
        };
    };
    status: {
        live: boolean;
        region: string;
        onchain: string;
    };
};
export declare function toolAccessOk(toolName: string, req?: any, options?: {
    ownerUserId?: string;
    businessId?: string;
    verifiedRail?: boolean;
}): Promise<{
    ok: boolean;
    reason: string;
    note?: undefined;
} | {
    ok: boolean;
    note: string;
    reason?: undefined;
}>;
//# sourceMappingURL=pabandiTools.service.d.ts.map