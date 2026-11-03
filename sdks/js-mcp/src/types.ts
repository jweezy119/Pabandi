/**
 * Pabandi MCP SDK - Type Definitions
 *
 * Defines types for interacting with the Pabandi MCP (Model Context Protocol)
 * server, including tool definitions, JSON-RPC messages, x402 payment
 * requirements, and session-based yield-bearing escrow operations.
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// JSON-RPC 2.0 Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
  id: string | number;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  result?: unknown;
  error?: JsonRpcError;
  id: string | number;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MCP Tool Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpToolCallRequest {
  name: string;
  arguments: Record<string, unknown>;
}

export interface McpToolCallResult {
  content: Array<{
    type: string;
    text?: string;
    data?: unknown;
    [key: string]: unknown;
  }>;
  isError?: boolean;
  [key: string]: unknown;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// X402 Payment Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** x402 v2 Payment Requirements (from 402 Payment-Required header) */
export interface X402PaymentRequirements {
  x402Version: number;
  resource: {
    url: string;
    description?: string;
    mimeType?: string;
  };
  accepts: Array<{
    scheme: string;
    network: string;
    amount: string; // atomic units as string
    asset: string; // token mint address
    payTo: string;
    maxTimeoutSeconds: number;
    extra?: Record<string, unknown>;
  }>;
  extensions?: Record<string, unknown>;
}

/** x402 v2 Payment Payload (for PAYMENT-SIGNATURE header) */
export interface X402V2PaymentPayload {
  x402Version: number;
  resource?: Record<string, unknown>;
  accepted?: Record<string, unknown>;
  payload: {
    transaction?: string;
    [key: string]: unknown;
  };
}

/** Parsed x402 payment result from the facilitator */
export interface X402VerificationResult {
  valid: boolean;
  reason?: string;
  transactionHash?: string;
}

/** Configuration for x402 payment facilitation */
export interface X402Config {
  facilitatorUrl: string;
  payoutAddress: string;
  allowUnverified?: boolean;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MCP Client Options & Errors
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface McpClientOptions {
  /** MCP server endpoint URL */
  baseUrl: string;
  /** API key for authentication (sent as x-api-key header) */
  apiKey?: string;
  /** Bearer token for authentication (sent as Authorization header) */
  bearerToken?: string;
  /** Optional x402 configuration for automatic payment handling */
  x402?: X402Config;
  /** Fetch implementation (defaults to global fetch) */
  fetch?: typeof fetch;
}

/** Error thrown when x402 payment is required */
export class X402PaymentRequiredError extends Error {
  readonly requirements: X402PaymentRequirements;
  constructor(requirements: X402PaymentRequirements) {
    super(JSON.stringify(requirements));
    this.name = 'X402PaymentRequiredError';
    this.requirements = requirements;
  }
}

/** Result of a tool call with payment info */
export interface McpToolResult<T = unknown> {
  result: McpToolCallResult;
  x402Required?: boolean;
  paymentRequirements?: X402PaymentRequirements;
  data?: T;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Known Tool Names (matching server definitions)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const PabandiTools = {
  // Public (no auth required)
  VerifyPassport: 'pabandi_verify_passport',
  Discover: 'pabandi_discover',
  GetLedger: 'pabandi_get_ledger',

  // Authenticated
  IssuePassport: 'pabandi_issue_passport',
  ExecuteTransaction: 'pabandi_execute_transaction',
  GetServices: 'pabandi_get_services',
  CheckAvailability: 'pabandi_check_availability',
  CreateBooking: 'pabandi_create_booking',
  CancelBooking: 'pabandi_cancel_booking',
  EscrowLock: 'pabandi_escrow_lock',
  EscrowRelease: 'pabandi_escrow_release',
  EscrowCreateChild: 'pabandi_escrow_create_child',
  TrustResolve: 'pabandi_trust_resolve',
  EscrowBalance: 'pabandi_escrow_balance',
  M2MPostProject: 'pabandi_m2m_post_project',
  SessionClose: 'pabandi_session_close',
  SessionReceipts: 'pabandi_session_receipts',
  SessionList: 'pabandi_session_list',
  IdentityRegister: 'pabandi_identity_register',
  IdentityReputationSync: 'pabandi_identity_reputation_sync',
  DiscoverAgents: 'pabandi_discover_agents',
  EscrowWaterfall: 'pabandi_escrow_waterfall',
  SchedulerPriority: 'pabandi_scheduler_priority',
  AgentCard: 'pabandi_agent_card',
  AgentRegistry: 'pabandi_agent_registry',
  CheckCounterparty: 'pabandi_check_counterparty',
  RequestEscrow: 'pabandi_request_escrow',
  SubmitDisputeEvidence: 'pabandi_submit_dispute_evidence',
  GetAdjudicationStatus: 'pabandi_get_adjudication_status',

  // Platform / discovery
  DiscoverPlatform: 'pabandi_discover_platform',
  PlatformAccess: 'pabandi_platform_access',
} as const;

export type PabandiToolName = typeof PabandiTools[keyof typeof PabandiTools];
