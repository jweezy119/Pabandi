import { fetch } from 'undici';
import { logger } from '../../utils/logger';
import { DataSourceAdapter, RawBusinessProfile } from './types';

const OPEN_DIRECTORIES_MCP_URL = 'https://secure-wave--opendirectories-business-data.apify.actor/mcp';

interface McpRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface McpResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

export class OpenDirectoriesAdapter implements DataSourceAdapter {
  readonly id = 'opendirectories';
  private requestId = 0;

  async fetchBusinesses(query: any): Promise<RawBusinessProfile[]> {
    const { country, state, category, min_rating } = query || {};

    try {
      // Initialize MCP session
      await this.sendMcpRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'pabandi-ingestion', version: '1.0.0' },
      });

      // List available tools to confirm search_businesses exists
      const toolsResp = await this.sendMcpRequest<{ tools: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }> }>('tools/list', {});
      const toolNames = toolsResp.result?.tools?.map((t: any) => t.name) || [];

      if (!toolNames.includes('search_businesses')) {
        logger.warn(`[OpenDirectories] search_businesses tool not found. Available: ${toolNames.join(', ')}`);
        return [];
      }

      // Call search_businesses
      const searchResp = await this.sendMcpRequest<{ businesses: Array<Record<string, unknown>> }>('tools/call', {
        name: 'search_businesses',
        arguments: {
          country,
          state,
          category,
          min_rating,
          limit: query.limit || 50,
        },
      });

      const rawBusinesses = searchResp.result?.businesses || [];
      return rawBusinesses.map((b: Record<string, unknown>) => this.mapBusiness(b));
    } catch (error) {
      logger.error(`[OpenDirectories] fetch failed: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  private async sendMcpRequest<T = unknown>(method: string, params?: Record<string, unknown>): Promise<McpResponse<T>> {
    const id = ++this.requestId;
    const payload: McpRequest = { jsonrpc: '2.0', id, method, ...(params ? { params } : {}) };

    const body = JSON.stringify(payload);
    const res = await fetch(OPEN_DIRECTORIES_MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(Buffer.byteLength(body)),
        Accept: 'application/json, text/event-stream',
      },
      body,
    });

    if (res.status !== 200) {
      throw new Error(`MCP request failed with status ${res.status}`);
    }

    const raw = await res.text();
    const parsed: McpResponse<T> = JSON.parse(raw);

    if (parsed.error) {
      throw new Error(`MCP error ${parsed.error.code}: ${parsed.error.message}`);
    }

    return parsed;
  }

  private mapBusiness(b: Record<string, unknown>): RawBusinessProfile {
    return {
      name: String(b.name || b.business_name || b.title || 'Unknown'),
      address: String(b.address || b.street_address || b.location || ''),
      city: b.city ? String(b.city) : undefined,
      state: b.state ? String(b.state) : undefined,
      country: b.country ? String(b.country) : undefined,
      postalCode: b.postal_code || b.postalCode || b.zip ? String(b.postal_code || b.postalCode || b.zip) : undefined,
      phone: b.phone ? String(b.phone) : undefined,
      email: b.email ? String(b.email) : undefined,
      website: b.website ? String(b.website) : undefined,
      lat: b.lat || b.latitude ? Number(b.lat || b.latitude) : undefined,
      lng: b.lng || b.longitude ? Number(b.lng || b.longitude) : undefined,
      googleRating: b.rating || b.googleRating ? Number(b.rating || b.googleRating) : undefined,
      reviewCount: b.review_count || b.reviewCount ? Number(b.review_count || b.reviewCount) : undefined,
      verificationStatus: b.verification_status ? String(b.verification_status) as 'verified' | 'unverified' | 'pending' : 'pending',
      sourceId: b.id || b.source_id || b.external_id ? String(b.id || b.source_id || b.external_id) : undefined,
      source: 'opendirectories',
    };
  }
}
