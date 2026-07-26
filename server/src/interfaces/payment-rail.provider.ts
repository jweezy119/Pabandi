export interface VerificationPayload {
  intentId: string;
  expectedAmountPkr: number;
  expectedDestination: string;
  // Rail-specific data
  screenshotBase64?: string; // Used by QwenScreenshotRail
  webhookData?: any;         // Used by EMI webhooks
}

export interface VerificationResult {
  isValid: boolean;
  confidence: number;
  providerTxnRef?: string;
  fields?: {
    transferAmount: number | null;
    recipientAccount: string | null;
    bankName: string | null;
    currency: string | null;
    transactionDate: string | null;
  };
  rawJson?: any;
}

export interface PaymentRailProvider {
  name: string;
  verifyPayment(payload: VerificationPayload): Promise<VerificationResult>;
}
