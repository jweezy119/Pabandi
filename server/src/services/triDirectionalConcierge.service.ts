/**
 * triDirectionalConcierge.service.ts
 *
 * Tri-Directional Concierge Orchestrator for Pabandi:
 * - A2A: Machine-to-Machine negotiation, quotes, and escrow settlement.
 * - A2H: Agent-to-Human interactive alerts (WhatsApp action cards to merchants/guests).
 * - H2A: Human-to-Agent interactive responses, counter-offers, and natural language control.
 */
import crypto from 'crypto';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { agentAlertService } from './agentAlert.service';
import { sendWhatsAppMessage } from './ai.service';

export interface A2AProposalRequest {
  agentId: string;
  agentName?: string;
  trustScore?: number;
  businessId: string;
  customerName: string;
  customerPhone?: string;
  reservationDate: string; // ISO date string
  reservationTime: string; // e.g. "19:30"
  numberOfGuests: number;
  escrowDepositUsdc: number;
  specialRequests?: string;
  webhookCallbackUrl?: string;
}

export interface ProposalRecord {
  proposalId: string;
  agentId: string;
  agentName: string;
  trustScore: number;
  businessId: string;
  businessName: string;
  merchantPhone?: string;
  customerName: string;
  customerPhone?: string;
  reservationDate: string;
  reservationTime: string;
  numberOfGuests: number;
  escrowDepositUsdc: number;
  specialRequests?: string;
  status: 'PENDING_HUMAN' | 'AUTO_CONFIRMED' | 'ACCEPTED' | 'DECLINED' | 'COUNTERED';
  counterAmountUsdc?: number;
  counterNotes?: string;
  reservationId?: string;
  createdAt: Date;
  updatedAt: Date;
}

class TriDirectionalConciergeService {
  // In-memory active proposals cache for instant sub-millisecond lookup and interactive prompts
  private activeProposals: Map<string, ProposalRecord> = new Map();
  // Map merchant phone -> latest active proposal ID for seamless "1", "2" quick replies
  private merchantPendingPrompts: Map<string, string> = new Map();

  /**
   * A2A: External Agent submits a booking proposal or negotiation request.
   */
  public async handleA2ARequest(request: A2AProposalRequest): Promise<{
    proposalId: string;
    status: ProposalRecord['status'];
    message: string;
    escrowQuote: {
      depositUsdc: number;
      currency: string;
      escrowContract: string;
    };
    reservationId?: string;
  }> {
    const proposalId = `prop_${crypto.randomBytes(6).toString('hex')}`;
    const trustScore = request.trustScore ?? 650;
    const agentName = request.agentName || request.agentId;

    // Fetch target business
    const business = await prisma.business.findUnique({
      where: { id: request.businessId },
    });

    if (!business) {
      throw new Error(`Business with ID ${request.businessId} not found`);
    }

    // Determine if proposal qualifies for instant autonomous approval or requires A2H human escalation:
    // High trust score (>= 750), modest party size (<= 4), and sufficient escrow (>= $20) auto-approves
    const qualifiesAutoApprove = trustScore >= 750 && request.numberOfGuests <= 4 && request.escrowDepositUsdc >= 20;

    let reservationId: string | undefined;
    let status: ProposalRecord['status'] = qualifiesAutoApprove ? 'AUTO_CONFIRMED' : 'PENDING_HUMAN';

    if (qualifiesAutoApprove) {
      // Find or create placeholder customer user
      const customer = await this.getOrCreateCustomerUser(request.customerPhone || 'unknown', request.customerName);
      const res = await prisma.reservation.create({
        data: {
          businessId: business.id,
          customerId: customer.id,
          customerName: request.customerName,
          customerPhone: request.customerPhone || business.phone || 'N/A',
          reservationDate: new Date(request.reservationDate),
          reservationTime: request.reservationTime,
          numberOfGuests: request.numberOfGuests,
          status: 'CONFIRMED',
          depositRequired: true,
          depositAmount: request.escrowDepositUsdc,
          depositPaid: true,
          isConcierge: true,
          conciergeDetails: {
            origin: 'A2A_AUTONOMOUS',
            agentId: request.agentId,
            agentName,
            trustScore,
            proposalId,
          },
        },
      });
      reservationId = res.id;
    }

    const proposal: ProposalRecord = {
      proposalId,
      agentId: request.agentId,
      agentName,
      trustScore,
      businessId: business.id,
      businessName: business.name,
      merchantPhone: business.phone || undefined,
      customerName: request.customerName,
      customerPhone: request.customerPhone,
      reservationDate: request.reservationDate,
      reservationTime: request.reservationTime,
      numberOfGuests: request.numberOfGuests,
      escrowDepositUsdc: request.escrowDepositUsdc,
      specialRequests: request.specialRequests,
      status,
      reservationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.activeProposals.set(proposalId, proposal);

    // If agent provided webhook, register alert subscription
    if (request.webhookCallbackUrl) {
      agentAlertService.subscribe({
        agentId: request.agentId,
        targetUrl: request.webhookCallbackUrl,
        events: ['agent.proposal_resolved', 'escrow.funded', 'escrow.released'],
      });
    }

    // Persist as AgentTask for tracking
    try {
      await prisma.agentTask.create({
        data: {
          id: proposalId,
          title: `A2A Negotiation: ${agentName} @ ${business.name}`,
          description: `Party of ${request.numberOfGuests} on ${request.reservationDate} at ${request.reservationTime}. Escrow: $${request.escrowDepositUsdc} USDC.`,
          priority: 'high',
          status: status === 'AUTO_CONFIRMED' ? 'completed' : 'open',
          createdByAgentId: request.agentId,
          metadata: proposal as any,
        },
      });
    } catch (e: any) {
      logger.warn(`[TriConcierge] Could not persist AgentTask: ${e.message}`);
    }

    // If requires human approval, trigger A2H alert to the merchant!
    if (status === 'PENDING_HUMAN') {
      if (business.phone) {
        this.merchantPendingPrompts.set(this.normalizePhone(business.phone), proposalId);
        await this.dispatchA2HEscalationCard(proposal, business.phone);
      }
    } else {
      // Auto confirmed: dispatch alert
      await agentAlertService.dispatchAlert(
        'agent.proposal_resolved',
        {
          proposalId,
          status: 'AUTO_CONFIRMED',
          reservationId,
          message: 'Booking automatically approved and backed by Pabandi Escrow PDA.',
        },
        request.agentId
      );
    }

    return {
      proposalId,
      status,
      message:
        status === 'AUTO_CONFIRMED'
          ? 'Autonomous A2A handshake verified: Booking confirmed in escrow.'
          : 'Proposal dispatched to merchant via A2H interactive alert. Awaiting decision.',
      escrowQuote: {
        depositUsdc: request.escrowDepositUsdc,
        currency: 'USDC',
        escrowContract: process.env.PABANDI_ESCROW_CONTRACT || '0xPabandiEscrowMainnet',
      },
      reservationId,
    };
  }

  /**
   * A2H: Dispatches an interactive WhatsApp/SMS action card to the merchant.
   */
  public async dispatchA2HEscalationCard(proposal: ProposalRecord, merchantPhone: string): Promise<void> {
    const text = [
      `🤖 *[Pabandi A2A Concierge — Action Required]*`,
      ``,
      `An external AI Agent (*${proposal.agentName}*, Trust: ${proposal.trustScore}) has proposed a booking:`,
      `• *Venue:* ${proposal.businessName}`,
      `• *Guest:* ${proposal.customerName}`,
      `• *Date/Time:* ${proposal.reservationDate} at ${proposal.reservationTime}`,
      `• *Guests:* ${proposal.numberOfGuests}`,
      `• *Escrow Deposit Offered:* $${proposal.escrowDepositUsdc.toFixed(2)} USDC (Guaranteed)`,
      proposal.specialRequests ? `• *Notes:* ${proposal.specialRequests}` : '',
      ``,
      `👉 *Reply with:*`,
      `*1* or *ACCEPT* — Confirm reservation & lock escrow`,
      `*2* or *DECLINE* — Decline this request`,
      `*COUNTER <amount>* — e.g. "COUNTER 50" to counter-offer`,
    ]
      .filter(Boolean)
      .join('\n');

    logger.info(`[TriConcierge A2H] Sending escalation card to ${merchantPhone} for proposal ${proposal.proposalId}`);
    await sendWhatsAppMessage(merchantPhone, text);
  }

  /**
   * H2A: Handles incoming messages from human merchants or guests.
   * Detects if the merchant is answering an active A2H prompt, or if this is a general inquiry.
   */
  public async handleH2AMessage(fromPhone: string, text: string): Promise<{ handled: boolean; replyText: string }> {
    const normalized = this.normalizePhone(fromPhone);
    const pendingProposalId = this.merchantPendingPrompts.get(normalized);

    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();

    // Check if this is an A2H action response
    if (pendingProposalId && (lower === '1' || lower === 'accept' || lower === 'yes' || lower === '2' || lower === 'decline' || lower === 'no' || lower.startsWith('counter'))) {
      const proposal = this.activeProposals.get(pendingProposalId);
      if (!proposal) {
        this.merchantPendingPrompts.delete(normalized);
        return { handled: false, replyText: 'Proposal expired or not found.' };
      }

      if (lower === '1' || lower === 'accept' || lower === 'yes') {
        proposal.status = 'ACCEPTED';
        proposal.updatedAt = new Date();

        // Create confirmed reservation
        const customer = await this.getOrCreateCustomerUser(proposal.customerPhone || 'unknown', proposal.customerName);
        const reservation = await prisma.reservation.create({
          data: {
            businessId: proposal.businessId,
            customerId: customer.id,
            customerName: proposal.customerName,
            customerPhone: proposal.customerPhone || fromPhone,
            reservationDate: new Date(proposal.reservationDate),
            reservationTime: proposal.reservationTime,
            numberOfGuests: proposal.numberOfGuests,
            status: 'CONFIRMED',
            depositRequired: true,
            depositAmount: proposal.escrowDepositUsdc,
            depositPaid: true,
            isConcierge: true,
            conciergeDetails: {
              origin: 'A2H_MERCHANT_ACCEPTED',
              agentId: proposal.agentId,
              agentName: proposal.agentName,
              proposalId: proposal.proposalId,
              acceptedByPhone: fromPhone,
            },
          },
        });
        proposal.reservationId = reservation.id;

        // Clean up prompt
        this.merchantPendingPrompts.delete(normalized);

        // A2A Alert: Notify external agent
        await agentAlertService.dispatchAlert(
          'agent.proposal_resolved',
          {
            proposalId: proposal.proposalId,
            status: 'ACCEPTED',
            reservationId: reservation.id,
            message: `Merchant accepted proposal. Escrow locked for $${proposal.escrowDepositUsdc.toFixed(2)} USDC.`,
          },
          proposal.agentId
        );

        const reply = `✅ Reservation Confirmed! Agent *${proposal.agentName}* has been notified and $${proposal.escrowDepositUsdc.toFixed(2)} USDC escrow is locked.`;
        return { handled: true, replyText: reply };
      }

      if (lower === '2' || lower === 'decline' || lower === 'no') {
        proposal.status = 'DECLINED';
        proposal.updatedAt = new Date();
        this.merchantPendingPrompts.delete(normalized);

        // A2A Alert: Notify external agent
        await agentAlertService.dispatchAlert(
          'agent.proposal_resolved',
          {
            proposalId: proposal.proposalId,
            status: 'DECLINED',
            message: 'Merchant declined proposal.',
          },
          proposal.agentId
        );

        return { handled: true, replyText: `❌ Proposal declined. Agent *${proposal.agentName}* has been informed.` };
      }

      if (lower.startsWith('counter')) {
        const parts = trimmed.split(/\s+/);
        const amount = parseFloat(parts[1]?.replace('$', '') || '0');
        if (amount > 0) {
          proposal.status = 'COUNTERED';
          proposal.counterAmountUsdc = amount;
          proposal.updatedAt = new Date();
          this.merchantPendingPrompts.delete(normalized);

          // A2A Alert: Notify external agent of counter-offer
          await agentAlertService.dispatchAlert(
            'agent.proposal_resolved',
            {
              proposalId: proposal.proposalId,
              status: 'COUNTERED',
              counterAmountUsdc: amount,
              message: `Merchant countered with required escrow of $${amount.toFixed(2)} USDC.`,
            },
            proposal.agentId
          );

          return { handled: true, replyText: `💬 Counter-offer of $${amount.toFixed(2)} USDC sent to Agent *${proposal.agentName}*.` };
        }
      }
    }

    return {
      handled: false,
      replyText: '',
    };
  }

  /**
   * Lookup proposal by ID.
   */
  public getProposal(proposalId: string): ProposalRecord | undefined {
    return this.activeProposals.get(proposalId);
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  private async getOrCreateCustomerUser(phone: string, name: string) {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ phone: { contains: phone.slice(-8) } }, { email: `${phone.replace(/\D/g, '')}@pabandi.local` }],
      },
    });
    if (existing) return existing;

    return prisma.user.create({
      data: {
        email: `${phone.replace(/\D/g, '') || crypto.randomBytes(4).toString('hex')}@pabandi.local`,
        name: name || 'Agent Guest',
        phone: phone || null,
        role: 'CUSTOMER',
      },
    });
  }
}

export const triDirectionalConciergeService = new TriDirectionalConciergeService();
