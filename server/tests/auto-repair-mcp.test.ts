import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  evaluateEstimateFairPrice,
  verifyRepairVisionProof,
} from '../src/services/autoRepairGuardrails.service';
import { handleRpc, TOOLS } from '../src/mcp/pabandiMcpServer';
import { prisma } from '../src/utils/database';

describe('Sprint 1 — Agentic US Auto Repair (MCP + AI Trust Guardrails)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes pabandi_search_auto_repair, pabandi_book_auto_repair, and pabandi_check_shop_trust in MCP tools/list', async () => {
    const res: any = await handleRpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const names = res.result.tools.map((t: any) => t.name);
    expect(names).toContain('pabandi_search_auto_repair');
    expect(names).toContain('pabandi_book_auto_repair');
    expect(names).toContain('pabandi_check_shop_trust');
    expect(TOOLS.length).toBeGreaterThanOrEqual(17);
  });

  it('AI Fair-Price Guardrail stamps FairPriceVerified when within 20% of US regional labor avg', () => {
    const fair = evaluateEstimateFairPrice([
      { serviceKey: 'brakes', description: 'Front Brake Pad Replacement', partCost: 140, laborHours: 1.5, laborRate: 130 },
    ]);
    expect(fair.passed).toBe(true);
    expect(fair.badge).toBe('FairPriceVerified');
    expect(fair.recommendedStatus).toBe('NEEDS_APPROVAL');
    expect(fair.flaggedItems).toHaveLength(0);
  });

  it('AI Fair-Price Guardrail flags PENDING_MANUAL_REVIEW when labor hours exceed US avg by >20%', () => {
    const inflated = evaluateEstimateFairPrice([
      { serviceKey: 'brakes', description: 'Front Brake Pad Replacement', partCost: 140, laborHours: 3.0, laborRate: 130 },
    ]);
    expect(inflated.passed).toBe(false);
    expect(inflated.badge).toBe('PENDING_MANUAL_REVIEW');
    expect(inflated.recommendedStatus).toBe('PENDING_MANUAL_REVIEW');
    expect(inflated.flaggedItems).toHaveLength(1);
    expect(inflated.maxVariancePct).toBe(100);
  });

  it('AI Vision Proof-of-Work verifies distinct Before/After photos and rejects duplicates', async () => {
    const ok = await verifyRepairVisionProof({
      repairOrderId: 'ro_test_1',
      beforeUrl: 'https://cdn.pabandi.com/dvi/worn-brake-pad.jpg',
      afterUrl: 'https://cdn.pabandi.com/dvi/new-ceramic-pad.jpg',
      serviceType: 'brakes',
    });
    expect(ok.verified).toBe(true);
    expect(ok.imagesDistinct).toBe(true);
    expect(ok.proofHash).toMatch(/^[a-f0-9]{64}$/);

    const dup = await verifyRepairVisionProof({
      repairOrderId: 'ro_test_1',
      beforeUrl: 'https://cdn.pabandi.com/dvi/same.jpg',
      afterUrl: 'https://cdn.pabandi.com/dvi/same.jpg',
      serviceType: 'brakes',
    });
    expect(dup.verified).toBe(false);
    expect(dup.imagesDistinct).toBe(false);
  });

  it('MCP tool pabandi_book_auto_repair creates an agent-booked RepairOrder and returns a Magic Link', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        Results: [{ ModelYear: '2021', Make: 'HONDA', Model: 'Accord', Trim: 'EX-L', VehicleType: 'PASSENGER CAR' }],
      }),
    } as any);

    (prisma as any).business = {
      findUnique: vi.fn().mockResolvedValue({
        id: 'shop_chi_01',
        name: 'Precision Auto Care Chicago',
        trustScore: 94,
        fairPriceScore: 96,
        communicationScore: 92,
      }),
    };
    (prisma as any).vehicle = {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: 'veh_01',
        vin: '1HGCV1F30MA000001',
        year: 2021,
        make: 'HONDA',
        model: 'Accord',
        licensePlate: null,
      }),
    };
    (prisma as any).repairOrder = {
      create: vi.fn().mockImplementation(async ({ data }: any) => ({
        id: 'ro_agent_001',
        ...data,
        vehicle: { id: 'veh_01', vin: '1HGCV1F30MA000001', year: 2021, make: 'HONDA', model: 'Accord' },
      })),
    };

    const rpcRes: any = await handleRpc({
      jsonrpc: '2.0',
      id: 42,
      method: 'tools/call',
      params: {
        name: 'pabandi_book_auto_repair',
        arguments: {
          shopId: 'shop_chi_01',
          vehicleVin: '1HGCV1F30MA000001',
          serviceType: 'brakes',
          clientPhone: '+13125550199',
        },
      },
    });

    expect(rpcRes.result.isError).toBe(false);
    const payload = JSON.parse(rpcRes.result.content[0].text);
    expect(payload.repairOrderId).toBe('ro_agent_001');
    expect(payload.isBookedByAgent).toBe(true);
    expect(payload.fairPriceVerified).toBe(true);
    expect(payload.vehicle.year).toBe(2021);
    expect(payload.vehicle.make).toBe('HONDA');
    expect(payload.magicLinkUrl).toContain('/b/ro_agent_001');
  });
});
