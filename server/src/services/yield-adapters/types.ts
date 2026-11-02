export interface YieldAdapter {
  id: string;
  deposit(amount: number, escrowId: string): Promise<void>;
  withdraw(amount: number, escrowId: string): Promise<{ principal: number; yield: number }>;
}

export interface YieldDepositRecord {
  escrowId: string;
  amount: number;
  depositedAt: number;
}
