import { prisma } from '../utils/database';
import { eventBus } from './event-bus.service';

export class PipelineTrustService {
  async enrichLeadWithTrust(clientId: string) {
    const client = await prisma.crmClient.findUnique({ where: { id: clientId } });
    if (!client) return null;

    const wallet = await prisma.walletPassport.findUnique({
      where: { holderId: client.passportId || '' },
    });

    return {
      ...client,
      trustScore: wallet?.score || 0,
      trustLevel: wallet?.level || 'bronze',
      verified: wallet?.verified || false,
    };
  }

  async getLeadRiskScore(clientId: string) {
    const client = await prisma.crmClient.findUnique({ where: { id: clientId } });
    if (!client) return 'high' as const;

    const wallet = await prisma.walletPassport.findUnique({
      where: { holderId: client.passportId || '' },
    });

    const score = wallet?.score || 0;
    if (score >= 70) return 'low' as const;
    if (score >= 40) return 'medium' as const;
    return 'high' as const;
  }

  async suggestTerms(clientId: string) {
    const client = await prisma.crmClient.findUnique({ where: { id: clientId } });
    if (!client) return { terms: 'prepayment', deposit: 100 };

    const wallet = await prisma.walletPassport.findUnique({
      where: { holderId: client.passportId || '' },
    });

    const score = wallet?.score || 0;
    if (score >= 80) return { terms: 'net-30', deposit: 0 };
    if (score >= 50) return { terms: 'net-15', deposit: 10 };
    return { terms: 'prepayment', deposit: 100 };
  }

  async flagHighRiskLeads(businessId: string) {
    const clients = await prisma.crmClient.findMany({ where: { businessId } });
    const highRisk = [];

    for (const client of clients) {
      const risk = await this.getLeadRiskScore(client.id);
      if (risk === 'high') highRisk.push(client);
    }

    return highRisk;
  }

  async updateScoreFromDeal(dealId: string) {
    const deal = await prisma.crmDeal.findUnique({ where: { id: dealId } });
    if (!deal) return null;

    eventBus.emitEvent('pipeline.deal.closed', { dealId, leadId: deal.leadId }, 'crm');
    return { success: true, message: 'Score update triggered' };
  }
}

export const pipelineTrust = new PipelineTrustService();
