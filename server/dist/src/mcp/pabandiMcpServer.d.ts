/**
 * pabandiMcpServer.ts — MCP distribution layer.
 *
 * Tools:
 *   1. pabandi_verify_passport     — verify PTP attestation (public)
 *   2. pabandi_discover             — PTP discovery doc (public)
 *   3. pabandi_get_ledger           — audit passport issuance charge (public)
 *   4. pabandi_issue_passport       — issue scoped metered passport (owner/auth)
 *   5. pabandi_discover_platform    — full Pabandi Platform doc
 *   6. pabandi_platform_access      — check caller access to a given tool
 *   7..N pabandi_<short>            — REAL platform HTTP proxy (calls canonical
 *                                     /api/v1/... endpoints server-side)
 *
 * Mounted at POST /mcp (Streamable HTTP).
 */
import { Request, Response } from 'express';
export declare const TOOLS: ({
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            token: {
                type: string;
                description: string;
            };
            need: {
                type: string;
                description: string;
            };
            idempotencyKey?: undefined;
            agentId?: undefined;
            capabilities?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            token?: undefined;
            need?: undefined;
            idempotencyKey?: undefined;
            agentId?: undefined;
            capabilities?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            idempotencyKey: {
                type: string;
                description?: undefined;
            };
            token?: undefined;
            need?: undefined;
            agentId?: undefined;
            capabilities?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            agentId: {
                type: string;
                description: string;
            };
            capabilities: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            idempotencyKey: {
                type: string;
                description: string;
            };
            token?: undefined;
            need?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {};
    };
    handler: () => {
        name: string;
        version: string;
        description: string;
        tools: {
            accessLabel: string;
            name: string;
            short: string;
            description: string;
            access: import("../services/pabandiTools.service").ToolAccess;
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
                access: import("../services/pabandiTools.service").ToolAccess;
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
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            toolName: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    handler: (_args: any, req?: Request) => Promise<{
        ok: boolean;
        note: string | undefined;
        toolName: any;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            [k: string]: {
                type: string;
                description: unknown;
            };
        };
        required: string[];
    };
    access: any;
    endpoints: any;
    registryName: any;
    handler: (args: any, req?: Request) => Promise<any>;
})[];
/** Express handler for POST /mcp */
export declare const mcpHandler: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=pabandiMcpServer.d.ts.map