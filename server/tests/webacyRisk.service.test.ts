import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { webacyRiskService, WebacyRiskBlockedError } from '../src/services/webacyRisk.service';
import { handleRpc, TOOLS } from '../src/mcp/pabandiMcpServer';
import { userHasScope } from '../src/services/agentScopes.service';

const VALID_SOLANA_WALLET = 'F5W934e6qJb8z2GZJj3kGjUfN6xLqK4W7CpHbBvRmN3D';
const SECOND_SOLANA_WALLET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

describe('Webacy Risk Intelligence Integration', () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    webacyRiskService.clearCache();
    process.env = { ...originalEnv };
    delete process.env.WEBACY_API_KEY;
    delete process.env.WEBACY_API_BASE_URL;
    delete process.env.WEBACY_MAX_ESCROW_RISK;
    delete process.env.WEBACY_FAIL_CLOSED;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns honest unconfigured status when WEBACY_API_KEY is unset', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as any;

    const result = await webacyRiskService.screenSolanaWallet(VALID_SOLANA_WALLET);
    expect(result.status).toBe('unconfigured');
    expect(result.overallRisk).toBeNull();
    expect(result.riskBand).toBe('UNKNOWN');
    expect(result.blocked).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects invalid Solana addresses locally without calling Webacy API', async () => {
    process.env.WEBACY_API_KEY = 'test_key';
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as any;

    await expect(webacyRiskService.screenSolanaWallet('not-a-valid-wallet')).rejects.toThrow(
      /Invalid Solana wallet address/i
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('screens a clean Solana wallet, sends x-api-key + chain=sol without /api prefix, and serves second call from LRU cache', async () => {
    process.env.WEBACY_API_KEY = 'webacy_live_test_key';
    process.env.WEBACY_API_BASE_URL = 'https://api.webacy.com/api/v2/';

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        count: 1,
        medium: 0,
        high: 0,
        overallRisk: 14.25,
        issues: [],
        isContract: false,
      }),
    });
    globalThis.fetch = fetchSpy as any;

    const first = await webacyRiskService.screenSolanaWallet(VALID_SOLANA_WALLET);
    expect(first.status).toBe('ok');
    expect(first.overallRisk).toBe(14.25);
    expect(first.riskBand).toBe('LOW');
    expect(first.blocked).toBe(false);
    expect(first.cached).toBe(false);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
    expect(calledUrl).toBe(`https://api.webacy.com/addresses/${VALID_SOLANA_WALLET}?chain=sol`);
    expect(calledInit.headers['x-api-key']).toBe('webacy_live_test_key');

    const second = await webacyRiskService.screenSolanaWallet(VALID_SOLANA_WALLET);
    expect(second.cached).toBe(true);
    expect(second.overallRisk).toBe(14.25);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('hard-blocks wallets at or above WEBACY_MAX_ESCROW_RISK (default 75)', async () => {
    process.env.WEBACY_API_KEY = 'webacy_live_test_key';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        count: 2,
        medium: 1,
        high: 1,
        overallRisk: 88.5,
        issues: [
          {
            score: 88.5,
            tags: [{ key: 'drainer_interaction', severity: 'high', description: 'Known Solana drainer interaction' }],
          },
        ],
        isContract: false,
      }),
    }) as any;

    await expect(webacyRiskService.assertSolanaWalletSafeForEscrow(VALID_SOLANA_WALLET)).rejects.toThrow(
      WebacyRiskBlockedError
    );
  });

  it('hard-blocks sanctioned wallets even if overallRisk is below numeric threshold', async () => {
    process.env.WEBACY_API_KEY = 'webacy_live_test_key';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        count: 1,
        medium: 0,
        high: 1,
        overallRisk: 40,
        issues: [{ tag: 'ofac_sanctioned', severity: 'high', description: 'OFAC SDN match' }],
      }),
    }) as any;

    const result = await webacyRiskService.screenSolanaWallet(SECOND_SOLANA_WALLET);
    expect(result.isSanctioned).toBe(true);
    expect(result.riskBand).toBe('CRITICAL');
    expect(result.blocked).toBe(true);

    await expect(webacyRiskService.assertSolanaWalletSafeForEscrow(SECOND_SOLANA_WALLET)).rejects.toThrow(
      /sanctions/i
    );
  });

  it('fails open with unavailable status on HTTP 429 by default, and fails closed when WEBACY_FAIL_CLOSED=true', async () => {
    process.env.WEBACY_API_KEY = 'webacy_live_test_key';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Too Many Requests',
    }) as any;

    const openResult = await webacyRiskService.assertSolanaWalletSafeForEscrow(VALID_SOLANA_WALLET);
    expect(openResult.status).toBe('unavailable');
    expect(openResult.blocked).toBe(false);
    expect(openResult.reason).toContain('429');

    process.env.WEBACY_FAIL_CLOSED = 'true';
    await expect(webacyRiskService.assertSolanaWalletSafeForEscrow(SECOND_SOLANA_WALLET)).rejects.toThrow(
      WebacyRiskBlockedError
    );
  });

  it('exposes pabandi_screen_wallet via MCP tools/list, tools/call, and trust scope', async () => {
    expect(TOOLS.some((t) => t.name === 'pabandi_screen_wallet')).toBe(true);
    expect(
      userHasScope(
        { id: 'u1', email: 'agent@pabandi.com', role: 'USER', agentKeyId: 'k1', scopes: ['trust'] },
        'pabandi_screen_wallet'
      )
    ).toBe(true);
    expect(
      userHasScope(
        { id: 'u1', email: 'agent@pabandi.com', role: 'USER', agentKeyId: 'k1', scopes: ['directory'] },
        'pabandi_screen_wallet'
      )
    ).toBe(false);

    process.env.WEBACY_API_KEY = 'webacy_live_test_key';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        count: 0,
        medium: 0,
        high: 0,
        overallRisk: 8,
        issues: [],
        isContract: false,
      }),
    }) as any;

    const listRes: any = await handleRpc({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
    expect(listRes.result.tools.some((t: any) => t.name === 'pabandi_screen_wallet')).toBe(true);

    const callRes: any = await handleRpc({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'pabandi_screen_wallet', arguments: { walletAddress: VALID_SOLANA_WALLET } },
    });
    expect(callRes.result.isError).toBe(false);
    const parsed = JSON.parse(callRes.result.content[0].text);
    expect(parsed.provider).toBe('webacy');
    expect(parsed.overallRisk).toBe(8);
    expect(parsed.riskBand).toBe('LOW');
    expect(parsed.blocked).toBe(false);
  });
});
