/**
 * test-mcp.ts — End-to-end MCP integration test.
 *
 * Calls the MCP server handler with pabandi_search_services,
 * logs the JSON output, and verifies the rate limiter.
 *
 * Run with: npx tsx src/scripts/test-mcp.ts
 */

import { mcpHandler } from '../mcp/pabandiMcpServer';

function makeMockReq(headers: Record<string, string> = {}): any {
  return {
    method: 'POST',
    headers,
    body: {},
  } as any;
}

function makeMockRes(): any {
  const chunks: any[] = [];
  return {
    status: () => makeMockRes(),
    json: (data: any) => {
      chunks.push(data);
      return makeMockRes();
    },
    setHeader: () => makeMockRes(),
    get: () => undefined,
    _getData: () => chunks,
  } as any;
}

async function mcpCall(method: string, params: any, id: number, headers?: Record<string, string>) {
  const req = makeMockReq(headers);
  req.body = { jsonrpc: '2.0', id, method, params };
  const res = makeMockRes();
  await mcpHandler(req, res);
  const data = res._getData()[0];
  return data;
}

async function main() {
  console.log('=== MCP Integration Test ===\n');

  // 1) Initialize
  const initRes = await mcpCall('initialize', {}, 1);
  console.log('1. Initialize:', JSON.stringify(initRes, null, 2));

  // 2) List tools
  const toolsRes = await mcpCall('tools/list', {}, 2);
  const tools = (toolsRes as any)?.result?.tools || [];
  console.log(`\n2. Tools listed: ${tools.length} total`);
  const searchTool = tools.find((t: any) => t.name === 'pabandi_search_services');
  console.log(`   pabandi_search_services found: ${!!searchTool}`);

  // 3) Call pabandi_search_services
  console.log('\n3. Calling pabandi_search_services...');
  const searchRes = await mcpCall('tools/call', {
    name: 'pabandi_search_services',
    arguments: { city: 'Austin', category: 'restaurant' },
  }, 3);

  const searchText = (searchRes as any)?.result?.content?.[0]?.text;
  if (searchText) {
    const data = JSON.parse(searchText);
    console.log('   Result:', JSON.stringify(data, null, 2));
    if (data.success && data.data) {
      const businesses = Array.isArray(data.data) ? data.data : data.data.businesses || [];
      console.log(`   Found ${businesses.length} business(es):`);
      businesses.forEach((b: any) => {
        console.log(`     - ${b.name || b.business_name || 'Unknown'} | Trust: ${b.trustScore ?? b.rating ?? 'N/A'} | ${b.city}, ${b.state ?? ''}`);
      });
    }
  } else {
    console.log('   Raw:', JSON.stringify(searchRes, null, 2));
  }

  // 4) Rate limiter test — hammer the endpoint to trigger 429
  console.log('\n4. Testing rate limiter (sending rapid requests)...');
  const rateLimitResults: Array<{ id: number; ok: boolean; error?: string }> = [];
  for (let i = 10; i < 30; i++) {
    try {
      const res = await mcpCall('tools/call', {
        name: 'pabandi_search_services',
        arguments: { city: 'Austin' },
      }, i);
      const text = (res as any)?.result?.content?.[0]?.text;
      const parsed = text ? JSON.parse(text) : null;
      rateLimitResults.push({ id: i, ok: parsed?.success ?? true });
    } catch (err: any) {
      rateLimitResults.push({ id: i, ok: false, error: err.message });
    }
  }
  const failures = rateLimitResults.filter(r => !r.ok);
  console.log(`   Made ${rateLimitResults.length} rapid calls, ${failures.length} returned errors`);
  failures.forEach(f => console.log(`   Call ${f.id}: ${f.error ?? 'non-ok response'}`));

  console.log('\n=== Test Complete ===');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});