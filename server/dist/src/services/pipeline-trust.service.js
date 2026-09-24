"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pipelineTrust = exports.PipelineTrustService = void 0;
const database_1 = require("../utils/database");
const event_bus_service_1 = require("./event-bus.service");
class PipelineTrustService {
    async enrichLeadWithTrust(leadId) {
        const lead = await database_1.prisma.contactLead.findUnique({ where: { id: leadId } });
        if (!lead)
            return null;
        const wallet = await database_1.prisma.walletPassport.findUnique({
            where: { holderId: lead.passportId || '' },
        });
        return {
            ...lead,
            trustScore: wallet?.score || 0,
            trustLevel: wallet?.level || 'bronze',
            verified: wallet?.verified || false,
        };
    }
    async getLeadRiskScore(leadId) {
        const lead = await database_1.prisma.contactLead.findUnique({ where: { id: leadId } });
        if (!lead)
            return 'high';
        const wallet = await database_1.prisma.walletPassport.findUnique({
            where: { holderId: lead.passportId || '' },
        });
        const score = wallet?.score || 0;
        if (score >= 70)
            return 'low';
        if (score >= 40)
            return 'medium';
        return 'high';
    }
    async suggestTerms(leadId) {
        const lead = await database_1.prisma.contactLead.findUnique({ where: { id: leadId } });
        if (!lead)
            return { terms: 'prepayment', deposit: 100 };
        const wallet = await database_1.prisma.walletPassport.findUnique({
            where: { holderId: lead.passportId || '' },
        });
        const score = wallet?.score || 0;
        if (score >= 80)
            return { terms: 'net-30', deposit: 0 };
        if (score >= 50)
            return { terms: 'net-15', deposit: 10 };
        return { terms: 'prepayment', deposit: 100 };
    }
    async flagHighRiskLeads(businessId) {
        const leads = await database_1.prisma.contactLead.findMany({ where: { businessId } });
        const highRisk = [];
        for (const lead of leads) {
            const risk = await this.getLeadRiskScore(lead.id);
            if (risk === 'high')
                highRisk.push(lead);
        }
        return highRisk;
    }
    async updateScoreFromDeal(dealId) {
        const deal = await database_1.prisma.contactDeal.findUnique({ where: { id: dealId } });
        if (!deal)
            return null;
        event_bus_service_1.eventBus.emitEvent('pipeline.deal.closed', { dealId, leadId: deal.leadId });
        return { success: true, message: 'Score update triggered' };
    }
}
exports.PipelineTrustService = PipelineTrustService;
exports.pipelineTrust = new PipelineTrustService();
//# sourceMappingURL=pipeline-trust.service.js.map