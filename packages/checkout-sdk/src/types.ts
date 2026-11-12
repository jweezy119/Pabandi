export type CheckoutRail = 'solana' | 'raast' | 'card';

export interface CounterpartyInfo {
  id: string;
  name: string;
  trustScore?: number;
  disputeRate?: number;
  walletAddress?: string;
  zkProofPayload?: {
    issuer: string;
    subjectId: string;
    issuedAt: number;
    predicates: {
      trustScore: string;
      disputeRate: string;
    };
    signature: string;
  };
}

export interface ZkVerificationResult {
  isValid: boolean;
  score: number;
  disputeRate: number;
  predicatesVerified: string[];
  error?: string;
}

export interface CheckoutSuccessEvent {
  rail: CheckoutRail;
  amount: number;
  currency: string;
  referenceId: string;
  txHashOrRef?: string;
  escrowStatus: 'LOCKED' | 'PENDING' | 'SETTLED';
  zkVerified?: boolean;
}

export interface CheckoutOptions {
  /** Pabandi Publishable API Key */
  publishableKey: string;
  /** Payable amount in selected currency */
  amount: number;
  /** Currency code (defaults to USDC) */
  currency?: 'USD' | 'USDC' | 'PKR';
  /** External merchant reference or invoice identifier */
  referenceId: string;
  /** Modal headline */
  title?: string;
  /** Modal description or service details */
  subtitle?: string;
  /** Pabandi Backend API host (defaults to production or localhost) */
  apiHost?: string;
  /** Merchant recipient Solana wallet address for USDC escrow deposits */
  recipientWallet?: string;
  /** Merchant Pakistani Raast ID (instant bank identifier) */
  merchantRaastId?: string;
  /** Merchant Pakistani IBAN */
  merchantIban?: string;
  /** Note attached to escrow/card transaction */
  squareNote?: string;
  /** Counterparty business or technician profile */
  counterparty?: CounterpartyInfo;
  /** When true, automatically checks and displays cryptographic BBS+ ZK Trust validation */
  verifyCounterpartyZK?: boolean;
  /** Visual appearance (defaults to 'dark' using pbn-tokens) */
  theme?: 'dark' | 'light' | 'auto';
  /** Callback fired upon verified escrow deposit */
  onSuccess?: (event: CheckoutSuccessEvent) => void;
  /** Callback fired when the user closes/dismisses the modal */
  onCancel?: () => void;
  /** Callback fired on payment or verification failure */
  onError?: (error: Error) => void;
}

