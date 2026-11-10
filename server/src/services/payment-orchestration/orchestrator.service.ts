import { 
  IPaymentConnector, 
  PaymentRailId, 
  PaymentLifecycleStatus,
  ConnectorPaymentRequest,
  ConnectorPaymentResponse,
  connectorRegistry 
} from './connectors';
import { ledgerService, JournalTransaction } from './ledger.service';
import { logger } from '../../utils/logger';

export interface CreatePaymentIntentParams {
  amount: number;
  currency: string;
  reference: string;
  payer?: {
    id?: string;
    name?: string;
    email?: string;
    wallet?: string;
    phone?: string;
  };
  payee?: {
    id?: string;
    name?: string;
    wallet?: string;
    raastId?: string;
    phone?: string;
  };
  preferredRail?: 'auto' | PaymentRailId;
  requireSharia?: boolean;
  isAgent?: boolean;
  webhookUrl?: string;
  metadata?: Record<string, any>;
  idempotencyKey?: string;
}

export interface OrchestratedPaymentIntent {
  paymentId: string;
  idempotencyKey?: string;
  status: PaymentLifecycleStatus;
  amount: number;
  currency: string;
  reference: string;
  selectedRail: PaymentRailId;
  fallbackRails: PaymentRailId[];
  connectorRef: string;
  isShariaCompliant: boolean;
  routingReason: string;
  paymentDetails: {
    paymentUrl?: string;
    clientSecret?: string;
    solanaPayUrl?: string;
    qrData?: string;
    instructions?: string;
    estimatedFee: number;
    settlementSpeed: string;
    expiresAt: string;
  };
  payer?: Record<string, any>;
  payee?: Record<string, any>;
  webhookUrl?: string;
  ledgerJournalId?: string;
  createdAt: string;
  updatedAt: string;
}

export class PaymentOrchestratorService {
  private static instance: PaymentOrchestratorService;
  private intents: Map<string, OrchestratedPaymentIntent> = new Map();
  private idempotencyCache: Map<string, string> = new Map(); // idempotencyKey -> paymentId

  private constructor() {}

  static getInstance(): PaymentOrchestratorService {
    if (!PaymentOrchestratorService.instance) {
      PaymentOrchestratorService.instance = new PaymentOrchestratorService();
    }
    return PaymentOrchestratorService.instance;
  }

  /**
   * Evaluates optimal payment rail based on cost, speed, compliance, and user context.
   */
  private determineOptimalRail(params: CreatePaymentIntentParams): {
    primary: PaymentRailId;
    fallbacks: PaymentRailId[];
    reason: string;
  } {
    const { preferredRail, currency, requireSharia, isAgent } = params;
    const normCurrency = currency.toUpperCase();

    // Explicit override if specified and not 'auto'
    if (preferredRail && preferredRail !== 'auto') {
      const conn = connectorRegistry.get(preferredRail);
      if (conn) {
        if (requireSharia && !conn.isShariaCompliant) {
          logger.warn(`Preferred rail ${preferredRail} is not Sharia-compliant; auto-correcting to Islamic rail.`);
        } else {
          return {
            primary: preferredRail,
            fallbacks: preferredRail === 'solana' ? ['raast', 'stripe'] : ['solana', 'jazzcash'],
            reason: `Manually requested rail ${conn.name}`,
          };
        }
      }
    }

    // Agent autonomous payments -> Solana USDC Escrow (sub-second finality, 0% conversion, Anchor smart contract)
    if (isAgent || normCurrency === 'USDC' || normCurrency === 'SOL') {
      return {
        primary: 'solana',
        fallbacks: ['raast', 'stripe'],
        reason: 'Optimal sub-second programmable escrow for AI agents with 0% FX spread and AAOIFI Sharia compliance',
      };
    }

    // Pakistan Domestic Rails (PKR) -> Raast (0% fee SBP rail) with JazzCash fallback
    if (normCurrency === 'PKR') {
      return {
        primary: 'raast',
        fallbacks: ['jazzcash', 'solana'],
        reason: 'State Bank of Pakistan Raast instant rail with 0% fee clearing and 100% bank interoperability',
      };
    }

    // Sharia Compliance Required -> Solana USDC or Raast
    if (requireSharia) {
      return {
        primary: 'solana',
        fallbacks: ['raast', 'jazzcash'],
        reason: 'Non-custodial, asset-backed, zero-Riba rail adhering strictly to AAOIFI Islamic Finance standard',
      };
    }

    // Standard International Cards (USD/EUR) -> Stripe with Solana USDC fallback
    return {
      primary: 'stripe',
      fallbacks: ['solana', 'raast'],
      reason: 'Universal card acceptance across 135+ currencies, Apple Pay, and Google Pay with 3D-Secure',
    };
  }

  /**
   * Mode A: Primary Orchestrator Entrypoint
   * Handles idempotency, dynamic routing, connector execution, and ledger entry.
   */
  async createPayment(params: CreatePaymentIntentParams): Promise<OrchestratedPaymentIntent> {
    const { idempotencyKey, reference, amount, currency, payer, payee, webhookUrl, metadata } = params;

    // Idempotency check
    const dedupKey = idempotencyKey || `ref_${reference}`;
    const existingPaymentId = this.idempotencyCache.get(dedupKey);
    if (existingPaymentId && this.intents.has(existingPaymentId)) {
      logger.info(`[Orchestrator] Idempotent hit for key ${dedupKey} -> returning ${existingPaymentId}`);
      return this.intents.get(existingPaymentId)!;
    }

    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const routing = this.determineOptimalRail(params);

    // Attempt primary rail connector
    let connector = connectorRegistry.get(routing.primary);
    let connectorResponse: ConnectorPaymentResponse;

    try {
      if (!connector) throw new Error(`Connector for rail ${routing.primary} not registered`);

      const connectorReq: ConnectorPaymentRequest = {
        paymentId,
        amount,
        currency,
        reference,
        payer,
        payee,
        requireSharia: params.requireSharia,
        metadata,
        webhookUrl,
      };

      connectorResponse = await connector.initiatePayment(connectorReq);
    } catch (primaryErr: any) {
      logger.warn(`[Orchestrator] Primary rail ${routing.primary} failed. Triggering automatic failover cascade:`, primaryErr.message);

      // Automatic failover to next rail in cascade
      const fallbackRail = routing.fallbacks[0] || 'solana';
      connector = connectorRegistry.get(fallbackRail)!;
      connectorResponse = await connector.initiatePayment({
        paymentId,
        amount,
        currency,
        reference,
        payer,
        payee,
        requireSharia: params.requireSharia,
        metadata,
        webhookUrl,
      });

      routing.primary = fallbackRail;
      routing.reason += ` (Failover executed from original rail due to connector offline)`;
    }

    // Record initial ledger transaction
    const journal = ledgerService.recordPaymentSettlement({
      paymentId,
      reference,
      rail: connectorResponse.railId,
      amount: connectorResponse.amount,
      currency: connectorResponse.currency,
      fee: connectorResponse.estimatedFee,
      payerId: payer?.id || payer?.email || payer?.wallet,
      payeeId: payee?.id || payee?.wallet || payee?.raastId,
    });

    const intent: OrchestratedPaymentIntent = {
      paymentId,
      idempotencyKey,
      status: connectorResponse.status,
      amount: connectorResponse.amount,
      currency: connectorResponse.currency,
      reference,
      selectedRail: connectorResponse.railId,
      fallbackRails: routing.fallbacks,
      connectorRef: connectorResponse.connectorRef,
      isShariaCompliant: connectorResponse.isShariaCompliant,
      routingReason: routing.reason,
      paymentDetails: {
        paymentUrl: connectorResponse.paymentUrl,
        clientSecret: connectorResponse.clientSecret,
        solanaPayUrl: connectorResponse.solanaPayUrl,
        qrData: connectorResponse.qrData,
        instructions: connectorResponse.instructions,
        estimatedFee: connectorResponse.estimatedFee,
        settlementSpeed: connectorResponse.settlementSpeed,
        expiresAt: connectorResponse.expiresAt,
      },
      payer,
      payee,
      webhookUrl,
      ledgerJournalId: journal.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.intents.set(paymentId, intent);
    this.idempotencyCache.set(dedupKey, paymentId);

    logger.info(`[Orchestrator] Created payment intent ${paymentId} on rail ${intent.selectedRail}.`);
    return intent;
  }

  getPayment(paymentId: string): OrchestratedPaymentIntent | undefined {
    return this.intents.get(paymentId);
  }

  /**
   * Updates payment intent lifecycle state and dispatches partner webhook.
   */
  async updateStatus(
    paymentId: string, 
    newStatus: PaymentLifecycleStatus, 
    metadata?: Record<string, any>
  ): Promise<OrchestratedPaymentIntent | null> {
    const intent = this.intents.get(paymentId);
    if (!intent) return null;

    intent.status = newStatus;
    intent.updatedAt = new Date().toISOString();

    if (metadata) {
      intent.paymentDetails = { ...intent.paymentDetails, ...metadata };
    }

    logger.info(`[Orchestrator] Payment ${paymentId} status transitioned -> ${newStatus}`);

    // If partner configured a webhook, notify them
    if (intent.webhookUrl) {
      this.dispatchWebhook(intent.webhookUrl, {
        event: `payment.${newStatus.toLowerCase()}`,
        paymentId: intent.paymentId,
        status: intent.status,
        amount: intent.amount,
        currency: intent.currency,
        reference: intent.reference,
        rail: intent.selectedRail,
        timestamp: intent.updatedAt,
      }).catch((e) => logger.error(`[Orchestrator] Webhook dispatch to ${intent.webhookUrl} failed:`, e));
    }

    return intent;
  }

  private async dispatchWebhook(url: string, payload: any): Promise<void> {
    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Pabandi-Signature': `sig_${Date.now()}`,
          'User-Agent': 'Pabandi-Orchestrator-Webhook/1.0',
        },
        body: JSON.stringify(payload),
      });
    } catch (e: any) {
      logger.warn(`[WebhookDispatcher] Warning: unable to deliver webhook to ${url}: ${e?.message}`);
    }
  }

  getAllIntents(): OrchestratedPaymentIntent[] {
    return Array.from(this.intents.values());
  }
}

export const paymentOrchestrator = PaymentOrchestratorService.getInstance();

