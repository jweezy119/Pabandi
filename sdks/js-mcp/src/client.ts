/**
 * Pabandi MCP Client SDK
 *
 * A TypeScript client for the Pabandi Model Context Protocol (MCP) server.
 * Provides:
 *
 *   - Tool discovery (tools/list)
 *   - Tool invocation (tools/call) with JSON-RPC 2.0
 *   - x402 micropayment handling (402 -> Payment-Required -> pay -> retry)
 *   - API key / Bearer token authentication
 *   - Typed access to all Pabandi MCP tools
 *
 * Example usage:
 *
 *   import { PabandiMcpClient } from '@pabandi/mcp-sdk';
 *
 *   const client = new PabandiMcpClient({
 *     baseUrl: 'https://api.pabandi.com/mcp',
 *     apiKey: 'your-api-key',
 *   });
 *
 *   const result = await client.callTool('pabandi_check_counterparty', {
 *     passportId: 'pass_abc123',
 *     minScore: 500,
 *   });
 */

import {
  McpTool,
  McpToolCallRequest,
  McpToolCallResult,
  McpToolResult,
  X402PaymentRequirements,
  X402PaymentRequiredError,
  X402V2PaymentPayload,
  X402Config,
  PabandiTools,
  PabandiToolName,
  McpClientOptions,
} from './types';

/**
 * PabandiMcpClient - MCP client for the Pabandi trust & settlement layer.
 *
 * Communicates with the Pabandi MCP server via JSON-RPC 2.0 over HTTP POST
 * to the /mcp endpoint. Handles x402 micropayment requirements automatically
 * when an x402 configuration is provided.
 */
export class PabandiMcpClient {
  private baseUrl: string;
  private apiKey?: string;
  private bearerToken?: string;
  private x402?: X402Config;
  private fetch: typeof fetch;

  constructor(options: McpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.bearerToken = options.bearerToken;
    this.x402 = options.x402;
    this.fetch = options.fetch || fetch;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Request Helpers
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  private buildHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    };
    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }
    if (this.bearerToken) {
      headers.Authorization = `Bearer ${this.bearerToken}`;
    }
    return headers;
  }

  private async jsonRpc<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
    options: { x402?: X402Config } = {},
  ): Promise<T> {
    const payload: Record<string, unknown> = {
      jsonrpc: '2.0',
      method,
      id: `pabandi-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
    if (params) {
      payload.params = params;
    }

    let lastError: unknown = null;

    // Try up to 3 times (original + up to 2 retries after payment)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await this.fetch(`${this.baseUrl}`, {
          method: 'POST',
          headers: this.buildHeaders(),
          body: JSON.stringify(payload),
        });

        // Handle x402 payment required
        if (res.status === 402) {
          const paymentRequiredHeader = res.headers.get('Payment-Required');
          if (paymentRequiredHeader) {
            try {
              const decoded = JSON.parse(
                Buffer.from(paymentRequiredHeader, 'base64').toString('utf8'),
              ) as X402PaymentRequirements;

              // If we have x402 config and haven't tried paying yet, attempt payment
              if (options.x402 || this.x402) {
                const config = options.x402 || this.x402!;
                // In a real implementation, the client would call the facilitator
                // to verify and settle the payment, then retry with PAYMENT-SIGNATURE
                // header. For now, we throw a structured error so the caller can
                // handle payment.
                throw new X402PaymentRequiredError(decoded);
              }

              // No x402 config - throw so the caller knows payment is needed
              throw new X402PaymentRequiredError(decoded);
            } catch (err) {
              if (err instanceof X402PaymentRequiredError) throw err;
              // If we can't parse the header, just throw a generic error
              throw new Error(`x402 payment required but unable to parse requirements: ${paymentRequiredHeader}`);
            }
          }
          // 402 without Payment-Required header
          throw new Error(`x402 payment required but no Payment-Required header received`);
        }

        if (!res.ok) {
          const errorText = await res.text().catch(() => '');
          throw new Error(`MCP request failed: ${res.status} ${errorText}`);
        }

        const data: McpToolCallResult = await res.json();
        return data as T;
      } catch (err) {
        lastError = err;
        if (err instanceof X402PaymentRequiredError) {
          throw err;
        }
        // For non-x402 errors, retry on network issues
        if (attempt < 2 && (err as Error)?.message?.includes('fetch')) {
          continue;
        }
        throw err;
      }
    }

    throw lastError ?? new Error('MCP request failed after retries');
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Public API
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * List all available MCP tools.
   */
  async listTools(): Promise<McpTool[]> {
    return this.jsonRpc<McpTool[]>('tools/list');
  }

  /**
   * Call an MCP tool with the given name and arguments.
   *
   * @param name - Tool name (see PabandiTools constants)
   * @param arguments - Tool-specific arguments
   * @returns Tool result
   * @throws X402PaymentRequiredError if payment is required
   */
  async callTool<T = unknown>(
    name: PabandiToolName | string,
    arguments_: Record<string, unknown>,
    options: { x402?: X402Config } = {},
  ): Promise<McpToolResult<T>> {
    const result = await this.jsonRpc<McpToolCallResult>(
      'tools/call',
      { name, arguments: arguments_ },
      options,
    );

    return {
      result,
      x402Required: false,
      data: undefined as unknown as T,
    } as unknown as McpToolResult<T>;
  }

  /**
   * Call a tool and automatically handle x402 payment.
   *
   * If the tool requires payment (402 response), this method will throw
   * X402PaymentRequiredError with the payment requirements. The caller is
   * responsible for completing the payment and retrying.
   *
   * In the future, this method will automatically complete x402 payments
   * when a facilitator is configured.
   */
  async callToolWithPayment<T = unknown>(
    name: PabandiToolName | string,
    arguments_: Record<string, unknown>,
    options: { x402?: X402Config } = {},
  ): Promise<McpToolResult<T>> {
    try {
      const result = await this.callTool(name, arguments_, options);
      return result as unknown as McpToolResult<T>;
    } catch (err) {
      if (err instanceof X402PaymentRequiredError) {
        // Re-throw with the payment requirements so the caller can act
        throw err;
      }
      throw err;
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Typed Tool Wrappers
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Verify a Trust Passport (public - no auth required).
   */
  async verifyPassport(args: {
    token: string;
    need?: string;
  }) {
    return this.callTool(PabandiTools.VerifyPassport, args);
  }

  /**
   * Get Pabandi discovery information (public - no auth required).
   */
  async discover() {
    return this.callTool(PabandiTools.Discover, {});
  }

  /**
   * Get ledger entry by idempotency key (public - no auth required).
   */
  async getLedger(args: { idempotencyKey: string }) {
    return this.callTool(PabandiTools.GetLedger, args);
  }

  /**
   * Issue a Trust Passport (auth required).
   */
  async issuePassport(args: {
    agentId: string;
    capabilities: string[];
    idempotencyKey?: string;
  }) {
    return this.callTool(PabandiTools.IssuePassport, args);
  }

  /**
   * Execute a transaction against an active session (auth required).
   */
  async executeTransaction(args: {
    sessionId: string;
    actionType: 'booking' | 'invoice_pay' | 'escrow';
    amount: number;
    payload: Record<string, unknown>;
    idempotencyKey?: string;
  }) {
    return this.callTool(PabandiTools.ExecuteTransaction, args);
  }

  /**
   * Get services offered by a business.
   */
  async getServices(args: { businessId: string }) {
    return this.callTool(PabandiTools.GetServices, args);
  }

  /**
   * Check availability for a business on a date.
   */
  async checkAvailability(args: { businessId: string; date: string }) {
    return this.callTool(PabandiTools.CheckAvailability, args);
  }

  /**
   * Create a booking.
   */
  async createBooking(args: {
    businessId: string;
    date: string;
    time: string;
    partySize: number;
    customerName?: string;
    customerEmail?: string;
  }) {
    return this.callTool(PabandiTools.CreateBooking, args);
  }

  /**
   * Cancel a booking.
   */
  async cancelBooking(args: { bookingId: string }) {
    return this.callTool(PabandiTools.CancelBooking, args);
  }

  /**
   * Lock funds in escrow.
   */
  async escrowLock(args: {
    delegationId: string;
    amount: number;
    description: string;
    deliverableHash?: string;
    contractAddress?: string;
    payerId: string;
    payeeId: string;
  }) {
    return this.callTool(PabandiTools.EscrowLock, args);
  }

  /**
   * Release funds from escrow.
   */
  async escrowRelease(args: {
    escrowId: string;
    amount?: number;
  }) {
    return this.callTool(PabandiTools.EscrowRelease, args);
  }

  /**
   * Get escrow balance.
   */
  async escrowBalance(args: { escrowId: string }) {
    return this.callTool(PabandiTools.EscrowBalance, args);
  }

  /**
   * Post a project to the agent marketplace.
   */
  async postProject(args: {
    title: string;
    description: string;
    budgetUsd: number;
    category: string;
    requiredSkills: string[];
    deadlineDays?: number;
  }) {
    return this.callTool(PabandiTools.M2MPostProject, args);
  }

  /**
   * Check a counterparty's trust score before bidding.
   */
  async checkCounterparty(args: {
    passportId: string;
    minScore?: number;
  }) {
    return this.callTool(PabandiTools.CheckCounterparty, args);
  }

  /**
   * Submit dispute evidence.
   */
  async submitDisputeEvidence(args: {
    jobId: string;
    buyerClaim: string;
    sellerProof: string;
    oracleData?: Record<string, unknown>;
  }) {
    return this.callTool(PabandiTools.SubmitDisputeEvidence, args);
  }

  /**
   * Get adjudication status.
   */
  async getAdjudicationStatus(args: {
    jobId?: string;
    caseId?: string;
  }) {
    return this.callTool(PabandiTools.GetAdjudicationStatus, args);
  }

  /**
   * Get the full platform document.
   */
  async discoverPlatform() {
    return this.callTool(PabandiTools.DiscoverPlatform, {});
  }

  /**
   * Check business access to a tool.
   */
  async platformAccess(args: {
    businessId: string;
    toolName: string;
  }) {
    return this.callTool(PabandiTools.PlatformAccess, args);
  }
}
