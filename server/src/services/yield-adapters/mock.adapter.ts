import { YieldAdapter, YieldDepositRecord } from './types';

// Mock yield provider for safe local testing. Simulates a 4% APY on Solana
// USDC vault deposits. Yield accrues from the real millisecond clock so the
// numbers are deterministic and time-based rather than hard-coded.
const MOCK_APY = 0.04;
const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

const deposits = new Map<string, YieldDepositRecord>();

export class MockYieldAdapter implements YieldAdapter {
  id = 'mock';

  async deposit(amount: number, escrowId: string): Promise<void> {
    deposits.set(escrowId, { escrowId, amount, depositedAt: Date.now() });
  }

  async withdraw(amount: number, escrowId: string): Promise<{ principal: number; yield: number }> {
    const record = deposits.get(escrowId);
    const principal = record ? record.amount : amount;
    const depositedAt = record ? record.depositedAt : Date.now();
    const elapsedMs = Date.now() - depositedAt;
    const yieldAmount = principal * (MOCK_APY / MS_PER_YEAR) * Math.max(elapsedMs, 0);
    deposits.delete(escrowId);
    return { principal, yield: yieldAmount };
  }
}
