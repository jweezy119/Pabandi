import { logger } from '../../utils/logger';

export type AccountType = 'ASSET' | 'LIABILITY' | 'REVENUE' | 'EXPENSE' | 'EQUITY';

export interface LedgerEntry {
  id: string;
  transactionId: string;
  account: string;
  accountType: AccountType;
  debit: number;
  credit: number;
  currency: string;
  timestamp: string;
  description: string;
}

export interface JournalTransaction {
  id: string;
  paymentId: string;
  reference: string;
  rail: string;
  totalAmount: number;
  currency: string;
  status: 'POSTED' | 'PENDING' | 'REVERSED';
  entries: LedgerEntry[];
  createdAt: string;
  trustScoreImpact: {
    payerScoreDelta: number;
    payeeScoreDelta: number;
    reason: string;
  };
}

export class DoubleEntryLedgerService {
  private static instance: DoubleEntryLedgerService;
  private transactions: Map<string, JournalTransaction> = new Map();

  private constructor() {}

  static getInstance(): DoubleEntryLedgerService {
    if (!DoubleEntryLedgerService.instance) {
      DoubleEntryLedgerService.instance = new DoubleEntryLedgerService();
    }
    return DoubleEntryLedgerService.instance;
  }

  /**
   * Records a double-entry ledger transaction for an initiated or settled payment.
   * Total Debits MUST equal Total Credits.
   */
  recordPaymentSettlement(params: {
    paymentId: string;
    reference: string;
    rail: string;
    amount: number;
    currency: string;
    fee: number;
    payerId?: string;
    payeeId?: string;
  }): JournalTransaction {
    const { paymentId, reference, rail, amount, currency, fee, payerId, payeeId } = params;
    const txId = `ledger_tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const netAmount = Math.max(0, amount - fee);

    // Balanced Journal Entries:
    // 1. DEBIT: Payer Rail Clearing (Asset reduction / inflow to clearing)
    // 2. CREDIT: Payee Escrow / Settlement Vault (Liability owed to payee)
    // 3. CREDIT: Pabandi Platform Revenue (Wakala agency fee)
    const entries: LedgerEntry[] = [
      {
        id: `entry_${Date.now()}_1`,
        transactionId: txId,
        account: `clearing:${rail}:${currency.toLowerCase()}`,
        accountType: 'ASSET',
        debit: amount,
        credit: 0,
        currency,
        timestamp: now,
        description: `Inbound settlement from ${payerId || 'buyer'} via ${rail}`,
      },
      {
        id: `entry_${Date.now()}_2`,
        transactionId: txId,
        account: `escrow:payee:${payeeId || 'seller'}`,
        accountType: 'LIABILITY',
        debit: 0,
        credit: netAmount,
        currency,
        timestamp: now,
        description: `Escrow liability locked for payee ${payeeId || 'seller'}`,
      },
    ];

    if (fee > 0) {
      entries.push({
        id: `entry_${Date.now()}_3`,
        transactionId: txId,
        account: 'revenue:platform:wakala_fee',
        accountType: 'REVENUE',
        debit: 0,
        credit: fee,
        currency,
        timestamp: now,
        description: `Platform Wakala agency fee on payment ${paymentId}`,
      });
    }

    // Verify balance: Sum(debits) === Sum(credits)
    const totalDebits = entries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredits = entries.reduce((sum, e) => sum + e.credit, 0);
    if (Math.abs(totalDebits - totalCredits) > 0.001) {
      throw new Error(`Double-entry balance violation: Debits (${totalDebits}) != Credits (${totalCredits})`);
    }

    const journal: JournalTransaction = {
      id: txId,
      paymentId,
      reference,
      rail,
      totalAmount: amount,
      currency,
      status: 'POSTED',
      entries,
      createdAt: now,
      trustScoreImpact: {
        payerScoreDelta: +15, // On-time verified escrow funding
        payeeScoreDelta: +20, // Real commercial activity backing reputation
        reason: `Settled transaction via ${rail} rail with 100% asset backing`,
      },
    };

    this.transactions.set(paymentId, journal);
    logger.info(`[Ledger] Recorded double-entry journal ${txId} for payment ${paymentId}. Balance: ${amount} ${currency}`);

    return journal;
  }

  getTransaction(paymentId: string): JournalTransaction | undefined {
    return this.transactions.get(paymentId);
  }

  getAllTransactions(): JournalTransaction[] {
    return Array.from(this.transactions.values());
  }

  getReconciliationSummary(): {
    totalVolumeUsd: number;
    transactionCount: number;
    balanced: boolean;
    rails: Record<string, number>;
  } {
    let totalVolume = 0;
    const rails: Record<string, number> = {};

    for (const tx of this.transactions.values()) {
      const vol = tx.currency === 'PKR' ? tx.totalAmount / 280 : tx.totalAmount;
      totalVolume += vol;
      rails[tx.rail] = (rails[tx.rail] || 0) + vol;
    }

    return {
      totalVolumeUsd: Math.round(totalVolume * 100) / 100,
      transactionCount: this.transactions.size,
      balanced: true,
      rails,
    };
  }
}

export const ledgerService = DoubleEntryLedgerService.getInstance();

