/**
 * agentAlert.service.ts
 *
 * Real-time Tri-Directional Alert and Event Bus for the Pabandi Agent Economy.
 * Dispatches proactive notifications and alerts:
 * - A2A: Machine-to-Machine alerts (slot drops, risk warnings, escrow milestones).
 * - A2H: Proactive alerts pushing to human merchants/guests via WhatsApp/SMS.
 */
import crypto from 'crypto';
import axios from 'axios';
import { EventEmitter } from 'events';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

export type AlertEventType =
  | 'inventory.slot_available'
  | 'booking.risk_elevated'
  | 'escrow.status_changed'
  | 'escrow.funded'
  | 'escrow.released'
  | 'escrow.disputed'
  | 'agent.proposal_pending'
  | 'agent.proposal_resolved';

export interface AgentAlertSubscription {
  id: string;
  agentId: string;
  targetUrl?: string; // Webhook callback for A2A HTTP pushes
  events: AlertEventType[];
  signingSecret: string;
  active: boolean;
  createdAt: Date;
}

export interface AlertPayload {
  eventId: string;
  eventType: AlertEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

class AgentAlertService extends EventEmitter {
  // In-memory subscriptions and SSE listeners for local/low-latency distribution
  private subscriptions: Map<string, AgentAlertSubscription> = new Map();
  private sseClients: Map<string, (payload: AlertPayload) => void> = new Map();

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  /**
   * Register or update an external agent's alert subscription.
   */
  public subscribe(params: {
    agentId: string;
    targetUrl?: string;
    events: AlertEventType[];
    signingSecret?: string;
  }): AgentAlertSubscription {
    const subId = `sub_${crypto.randomBytes(8).toString('hex')}`;
    const sub: AgentAlertSubscription = {
      id: subId,
      agentId: params.agentId,
      targetUrl: params.targetUrl,
      events: params.events.length > 0 ? params.events : ['inventory.slot_available', 'escrow.status_changed'],
      signingSecret: params.signingSecret || crypto.randomBytes(16).toString('hex'),
      active: true,
      createdAt: new Date(),
    };

    this.subscriptions.set(params.agentId, sub);
    logger.info(`[AgentAlert] Agent ${params.agentId} subscribed to alerts: ${sub.events.join(', ')}`);
    return sub;
  }

  /**
   * Unsubscribe an agent from alerts.
   */
  public unsubscribe(agentId: string): boolean {
    const removed = this.subscriptions.delete(agentId);
    this.sseClients.delete(agentId);
    return removed;
  }

  /**
   * Register a Server-Sent Events (SSE) listener for an agent.
   */
  public registerSseListener(agentId: string, listener: (payload: AlertPayload) => void): () => void {
    this.sseClients.set(agentId, listener);
    return () => {
      this.sseClients.delete(agentId);
    };
  }

  /**
   * Broadcast an alert across both Webhook and SSE channels.
   */
  public async dispatchAlert(eventType: AlertEventType, data: Record<string, unknown>, targetAgentId?: string): Promise<void> {
    const eventId = `evt_${crypto.randomBytes(8).toString('hex')}`;
    const payload: AlertPayload = {
      eventId,
      eventType,
      timestamp: new Date().toISOString(),
      data,
    };

    // Emit event on internal Node bus
    this.emit(eventType, payload);

    // Target specific agent or broadcast to all subscribed
    const targets = targetAgentId
      ? [this.subscriptions.get(targetAgentId)].filter(Boolean) as AgentAlertSubscription[]
      : Array.from(this.subscriptions.values()).filter((s) => s.active && s.events.includes(eventType));

    for (const sub of targets) {
      // 1. Deliver to SSE client if connected
      const sseSender = this.sseClients.get(sub.agentId);
      if (sseSender) {
        try {
          sseSender(payload);
        } catch (err: any) {
          logger.warn(`[AgentAlert] SSE delivery error for agent ${sub.agentId}: ${err?.message}`);
        }
      }

      // 2. Deliver via HTTP Webhook if targetUrl is set
      if (sub.targetUrl) {
        this.sendWebhookWithRetry(sub, payload).catch((err) => {
          logger.error(`[AgentAlert] Webhook delivery failed for ${sub.targetUrl}: ${err?.message}`);
        });
      }

      // 3. Persist alert as an internal AgentMessage for auditability
      this.persistAgentAlert(sub.agentId, eventType, payload).catch((err) => {
        logger.debug(`[AgentAlert] Failed to persist agent alert message: ${err?.message}`);
      });
    }
  }

  /**
   * Deliver webhook with HMAC signature.
   */
  private async sendWebhookWithRetry(sub: AgentAlertSubscription, payload: AlertPayload, attempt = 1): Promise<void> {
    if (!sub.targetUrl) return;
    const rawBody = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', sub.signingSecret)
      .update(rawBody)
      .digest('hex');

    try {
      await axios.post(sub.targetUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Pabandi-Event': payload.eventType,
          'X-Pabandi-Signature': signature,
          'X-Pabandi-Event-Id': payload.eventId,
          'User-Agent': 'Pabandi-Concierge-AgentAlert/2.0',
        },
        timeout: 5000,
      });
      logger.info(`[AgentAlert] Webhook delivered to ${sub.targetUrl} for ${payload.eventType}`);
    } catch (error: any) {
      if (attempt < 3) {
        setTimeout(() => this.sendWebhookWithRetry(sub, payload, attempt + 1), attempt * 1500);
      } else {
        throw error;
      }
    }
  }

  /**
   * Persist alert into AgentMessage table for tracking.
   */
  private async persistAgentAlert(agentId: string, eventType: string, payload: AlertPayload): Promise<void> {
    try {
      await prisma.agentMessage.create({
        data: {
          senderAgentId: 'system_concierge_alert',
          recipientAgentId: agentId,
          message: `[Alert: ${eventType}] ${JSON.stringify(payload.data).slice(0, 500)}`,
          context: payload as any,
          status: 'delivered',
        },
      });
    } catch {
      // Non-blocking
    }
  }

  // --- Convenience Helpers for Domain Events ---

  public async alertSlotAvailable(venueId: string, venueName: string, slotTime: string, covers: number, discountBps = 0): Promise<void> {
    await this.dispatchAlert('inventory.slot_available', {
      venueId,
      venueName,
      slotTime,
      covers,
      discountBps,
      availableAt: new Date().toISOString(),
    });
  }

  public async alertRiskElevated(bookingId: string, customerPhone: string, riskScore: number, requiredDepositUsdc: number, agentId?: string): Promise<void> {
    await this.dispatchAlert(
      'booking.risk_elevated',
      {
        bookingId,
        customerPhoneMasked: customerPhone.replace(/(\d{3})\d+(\d{2})/, '$1***$2'),
        riskScore,
        requiredDepositUsdc,
        reason: 'Pabandi predictive no-show threshold exceeded',
      },
      agentId
    );
  }

  public async alertEscrowFunded(escrowId: string, bookingId: string, amountUsdc: number, agentId?: string): Promise<void> {
    await this.dispatchAlert(
      'escrow.funded',
      {
        escrowId,
        bookingId,
        amountUsdc,
        status: 'LOCKED',
        timestamp: new Date().toISOString(),
      },
      agentId
    );
  }
}

export const agentAlertService = new AgentAlertService();
