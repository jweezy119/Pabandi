import axios from 'axios';
import { logger } from '../utils/logger';

const OPENWA_MCP_URL = (process.env.OPENWA_API_URL || 'http://localhost:2785/api').replace(/\/api$/, '/mcp');
const OPENWA_API_KEY = process.env.OPENWA_API_KEY || '';

export interface MCPToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolResult {
  toolResult: unknown;
  error?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export class OpenWAMCPClient {
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Helper to make HTTP POST requests to OpenWA's MCP HTTP transport endpoint.
   */
  private async request<T>(method: string, params: Record<string, unknown>): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Session-Id': this.sessionId,
    };

    if (OPENWA_API_KEY) {
      headers['X-API-Key'] = OPENWA_API_KEY;
    }

    const payload = {
      jsonrpc: '2.0',
      id: Date.now().toString(),
      method,
      params,
    };

    try {
      const response = await axios.post(OPENWA_MCP_URL, payload, { headers });
      
      if (response.data.error) {
        throw new Error(response.data.error.message || JSON.stringify(response.data.error));
      }
      
      return response.data.result as T;
    } catch (error: any) {
      logger.error(`[MCPClient] Request failed: ${error?.message || error}`);
      throw error;
    }
  }

  /**
   * Initialize the MCP session with OpenWA.
   */
  async initialize(): Promise<{ serverInfo: any; capabilities: any }> {
    return this.request<{ serverInfo: any; capabilities: any }>('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'Pabandi-AI-Agent',
        version: '1.0.0',
      },
    });
  }

  /**
   * List all available tools exposed by OpenWA.
   */
  async listTools(): Promise<{ tools: MCPTool[] }> {
    return this.request<{ tools: MCPTool[] }>('tools/list', {});
  }

  /**
   * Call a specific tool with arguments.
   */
  async callTool(call: MCPToolCall): Promise<MCPToolResult> {
    try {
      const result = await this.request<any>('tools/call', {
        name: call.name,
        arguments: call.arguments,
      });

      // Map MCP text/content array to a simple toolResult
      if (result.content && Array.isArray(result.content)) {
        const textContent = result.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text)
          .join('\n');
        
        // Try to parse as JSON if it looks like JSON
        try {
          return { toolResult: JSON.parse(textContent) };
        } catch {
          return { toolResult: textContent };
        }
      }
      
      return { toolResult: result };
    } catch (error: any) {
      return { toolResult: null, error: error.message };
    }
  }
}

/**
 * Creates a new session-scoped MCP client for OpenWA.
 */
export function createOpenWAMCPClient(sessionId: string): OpenWAMCPClient {
  return new OpenWAMCPClient(sessionId);
}
