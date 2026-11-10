/**
 * Standardized Connector Types for Pabandi Payment Orchestration Layer.
 * Inspired by Hyperswitch / Open Payments abstraction.
 */

export type PaymentRailId = 'solana' | 'raast' | 'stripe' | 'square' | 'jazzcash' | 'easypaisa';

export type PaymentLifecycleStatus = 
  | 'CREATED'
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'DISPUTED';

export interface ConnectorParticipant {
  id?: string;
  name?: string;
  email?: string;
  wallet?: string;
  raastId?: string;
  phone?: string;
}

export interface ConnectorPaymentRequest {
  paymentId: string;
  amount: number;
  currency: string;
  reference: string;
  payer?: ConnectorParticipant;
  payee?: ConnectorParticipant;
  requireSharia?: boolean;
  metadata?: Record<string, any>;
  webhookUrl?: string;
}

export interface ConnectorPaymentResponse {
  success: boolean;
  connectorRef: string;
  railId: PaymentRailId;
  status: PaymentLifecycleStatus;
  currency: string;
  amount: number;
  paymentUrl?: string;
  clientSecret?: string;
  solanaPayUrl?: string;
  qrData?: string;
  qrImageUrl?: string;
  instructions?: string;
  estimatedFee: number;
  settlementSpeed: string;
  isShariaCompliant: boolean;
  expiresAt: string;
  rawResponse?: Record<string, any>;
}

export interface ConnectorStatusResponse {
  connectorRef: string;
  railId: PaymentRailId;
  status: PaymentLifecycleStatus;
  amount: number;
  currency: string;
  settledAt?: string;
  txHash?: string;
  failureReason?: string;
  rawResponse?: Record<string, any>;
}

export interface ConnectorWebhookResult {
  handled: boolean;
  paymentId?: string;
  connectorRef?: string;
  newStatus?: PaymentLifecycleStatus;
  txHash?: string;
  error?: string;
}

export interface ConnectorRefundResponse {
  success: boolean;
  refundId: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
  error?: string;
}

export interface IPaymentConnector {
  readonly railId: PaymentRailId;
  readonly name: string;
  readonly supportedCurrencies: string[];
  readonly isShariaCompliant: boolean;
  readonly defaultFeePercent: number;
  readonly fixedFeeUsd: number;
  readonly averageSpeed: string;

  initiatePayment(request: ConnectorPaymentRequest): Promise<ConnectorPaymentResponse>;
  checkStatus(connectorRef: string): Promise<ConnectorStatusResponse>;
  processWebhook(payload: any, headers?: Record<string, string>): Promise<ConnectorWebhookResult>;
  refundPayment?(connectorRef: string, amount?: number): Promise<ConnectorRefundResponse>;
}

