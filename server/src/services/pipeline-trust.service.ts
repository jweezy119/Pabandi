import { prisma } from '../utils/database';
import { eventBus } from './event-bus.service';

export class PipelineTrustService {
  async enrichLeadWithTrust(leadId: string) {
    const lead = await prisma.pipelineLead.findUnique({ where: { id: leadId } });
    if (!lead) return null;

    const wallet = await prisma.walletPassport.findUnique({
      where: { userId: lead.passportId || '' },
    });

    return {
      ...lead,
      trustScore: wallet?.score || 0,
      trustLevel: wallet?.level || 'bronze',
      verified: wallet?.verified || false,
    };
  }

  async getLeadRiskScore(leadId: string) {
    const lead = await prisma.pipelineLead.findUnique({ where: { id: leadId } });
    if (!lead) return 'high' as const;

    const wallet = await prisma.walletPassport.findUnique({
      where: { userId: lead.passportId || '' },
    });

    const score = wallet?.score || 0;
    if (score >= 70) return 'low' as const;
    if (score >= 40) return 'medium' as const;
    return 'high' as const;
  }

  async suggestTerms(leadId: string) {
    const lead = await prisma.pipelineLead.findUnique({ where: { id: leadId } });
    if (!lead) return { terms: 'prepayment', deposit: 100 };

    const wallet = await prisma.walletPassport.findUnique({
      where: { userId: lead.passportId || '' },
    });

    const score = wallet?.score || 0;
    if (score >= 80) return { terms: 'net-30', deposit: 0 };
    if (score >= 50) return { terms: 'net-15', deposit: 10 };
    return { terms: 'prepayment', deposit: 100 };
  }

  async flagHighRiskLeads(businessId: string) {
    const leads = await prisma.pipelineLead.findMany({ where: { businessId } });
    const highRisk = [];

    for (const lead of leads) {
      const risk = await this.getLeadRiskScore(lead.id);
      if (risk === 'high') highRisk.push(lead);
    }

    return highRisk;
  }

  async updateScoreFromDeal(dealId: string) {
    const deal = await prisma.pipelineDeal.findUnique({ where: { id: dealId } });
    if (!deal) return null;

    eventBus.emitEvent('pipeline.deal.closed', { dealId, leadId: deal.leadId });
    return { success: true, message: 'Score update triggered' };
  }
}

export const pipelineTrust = new PipelineTrustService();
