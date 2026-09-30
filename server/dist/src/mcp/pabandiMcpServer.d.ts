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
export declare const TOOLS: any[];
/** Express handler for POST /mcp */
export declare const mcpHandler: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=pabandiMcpServer.d.ts.map