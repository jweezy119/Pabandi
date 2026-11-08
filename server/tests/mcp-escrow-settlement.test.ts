import { describe, it, expect } from 'vitest';
import { MCP_ESCROW_SETTLEMENT_RAKE } from '../src/config/fees';

describe('MCP Escrow Settlement & Revenue Capture', () => {
  it('enforces a 5% platform rake on settled agent bounties', () => {
    expect(MCP_ESCROW_SETTLEMENT_RAKE).toBe(0.05);
  });

  it('accurately splits gross escrow into net payout and captured platform revenue', () => {
    const testCases = [
      { grossUsd: 10.0, expectedFee: 0.5, expectedPayout: 9.5 },
      { grossUsd: 50.0, expectedFee: 2.5, expectedPayout: 47.5 },
      { grossUsd: 100.0, expectedFee: 5.0, expectedPayout: 95.0 },
      { grossUsd: 250.0, expectedFee: 12.5, expectedPayout: 237.5 },
      { grossUsd: 1000.0, expectedFee: 50.0, expectedPayout: 950.0 },
    ];

    for (const { grossUsd, expectedFee, expectedPayout } of testCases) {
      const platformFeeUsd = Math.round(grossUsd * MCP_ESCROW_SETTLEMENT_RAKE * 100) / 100;
      const netPayoutUsd = Math.round((grossUsd - platformFeeUsd) * 100) / 100;

      expect(platformFeeUsd).toBe(expectedFee);
      expect(netPayoutUsd).toBe(expectedPayout);
      expect(platformFeeUsd + netPayoutUsd).toBe(grossUsd);
    }
  });

  it('formats payload for TreasuryPosition OPERATING/ESCROW ledger entries', () => {
    const grossUsd = 100.0;
    const platformFeeUsd = Math.round(grossUsd * MCP_ESCROW_SETTLEMENT_RAKE * 100) / 100;
    const netPayoutUsd = Math.round((grossUsd - platformFeeUsd) * 100) / 100;
    const escrowId = 'escrow_test_cuid_123';
    const deliverableHash = 'sha256:4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a';

    const positionRecord = {
      bucket: 'OPERATING',
      kind: 'ESCROW',
      amount: platformFeeUsd,
      status: 'DEPLOYED',
      meta: {
        source: 'MCP_ESCROW_SETTLEMENT',
        escrowId,
        totalAmountUsd: grossUsd,
        platformFeeUsd,
        netPayoutUsd,
        platformFeeRate: '5%',
        deliverableHash,
      },
    };

    expect(positionRecord.bucket).toBe('OPERATING');
    expect(positionRecord.kind).toBe('ESCROW');
    expect(positionRecord.amount).toBe(5.0);
    expect(positionRecord.meta.platformFeeRate).toBe('5%');
  });
});

