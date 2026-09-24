"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.haqCommunication = exports.haqMaintenance = exports.haqLease = exports.haqTenant = exports.haqRevenue = exports.HaqCommunicationService = exports.HaqMaintenanceService = exports.HaqLeaseService = exports.HaqTenantService = exports.HaqRevenueService = void 0;
const database_1 = require("../utils/database");
class HaqRevenueService {
    async getRevenueSummary(managerId, period) {
        const now = new Date();
        const startDate = new Date();
        if (period === 'week')
            startDate.setDate(now.getDate() - 7);
        else if (period === 'month')
            startDate.setMonth(now.getMonth() - 1);
        else
            startDate.setFullYear(now.getFullYear() - 1);
        const payments = await database_1.prisma.propertyFinancial.findMany({
            where: { property: { managerId }, type: 'INCOME', date: { gte: startDate } },
        });
        const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const expenses = await database_1.prisma.propertyFinancial.findMany({
            where: { property: { managerId }, type: 'EXPENSE', date: { gte: startDate } },
        });
        const totalExpenses = expenses.reduce((sum, p) => sum + (p.amount || 0), 0);
        return {
            period,
            totalRevenue,
            totalExpenses,
            netIncome: totalRevenue - totalExpenses,
            paymentCount: payments.length,
            averagePayment: payments.length > 0 ? totalRevenue / payments.length : 0,
        };
    }
    async getRentCollectionRate(managerId) {
        const totalTenants = await database_1.prisma.propertyTenant.count({ where: { managerId } });
        const paidTenants = await database_1.prisma.propertyTenant.count({ where: { managerId, totalStays: { gt: 0 } } });
        return {
            totalTenants,
            paidTenants,
            collectionRate: totalTenants > 0 ? (paidTenants / totalTenants) * 100 : 0,
        };
    }
    async getTopProperties(managerId) {
        return database_1.prisma.propertyManagerProperty.findMany({
            where: { managerId },
            select: { id: true, title: true, address: true, rentAmount: true, status: true, _count: { select: { units: true } } },
            orderBy: { rentAmount: 'desc' },
            take: 5,
        });
    }
}
exports.HaqRevenueService = HaqRevenueService;
class HaqTenantService {
    async getTenants(managerId) {
        const tenants = await database_1.prisma.propertyTenant.findMany({
            where: { managerId },
            orderBy: { createdAt: 'desc' },
        });
        return tenants;
    }
    async getTenantDetail(tenantId) {
        const tenant = await database_1.prisma.propertyTenant.findUnique({ where: { id: tenantId } });
        if (!tenant)
            return null;
        const leases = await database_1.prisma.propertyLease.findMany({ where: { tenantEmail: tenant.email }, orderBy: { createdAt: 'desc' } });
        const maintenance = await database_1.prisma.propertyMaintenance.findMany({ where: { tenantEmail: tenant.email }, orderBy: { createdAt: 'desc' } });
        const payments = await database_1.prisma.propertyFinancial.findMany({ where: { tenantEmail: tenant.email, type: 'INCOME' }, orderBy: { date: 'desc' }, take: 12 });
        return { ...tenant, leases, maintenanceRequests: maintenance, paymentHistory: payments };
    }
    async updateTenantRisk(tenantId, riskBand) {
        return database_1.prisma.propertyTenant.update({ where: { id: tenantId }, data: { riskBand } });
    }
}
exports.HaqTenantService = HaqTenantService;
class HaqLeaseService {
    async getLeases(managerId, status) {
        const where = { managerId };
        if (status)
            where.status = status;
        return database_1.prisma.propertyLease.findMany({
            where,
            include: { property: { select: { title: true, address: true } }, unit: { select: { unitNumber: true } } },
            orderBy: { endDate: 'asc' },
        });
    }
    async createLease(data) {
        return database_1.prisma.propertyLease.create({ data: { ...data, status: 'DRAFT' } });
    }
    async renewLease(leaseId, data) {
        return database_1.prisma.propertyLease.update({
            where: { id: leaseId },
            data: { endDate: data.endDate, rentAmount: data.rentAmount || undefined, status: 'ACTIVE' },
        });
    }
    async terminateLease(leaseId, reason) {
        return database_1.prisma.propertyLease.update({ where: { id: leaseId }, data: { status: 'TERMINATED', notes: reason } });
    }
}
exports.HaqLeaseService = HaqLeaseService;
class HaqMaintenanceService {
    async submitRequest(tenantId, data) {
        const tenant = await database_1.prisma.propertyTenant.findUnique({ where: { id: tenantId } });
        if (!tenant)
            throw new Error('Tenant not found');
        return database_1.prisma.propertyMaintenance.create({
            data: { managerId: tenant.managerId, tenantEmail: tenant.email, title: data.category, description: data.description, priority: data.priority.toUpperCase(), status: 'OPEN' },
        });
    }
    async getRequests(managerId, status) {
        const where = { managerId };
        if (status)
            where.status = status.toUpperCase();
        return database_1.prisma.propertyMaintenance.findMany({
            where,
            include: { property: { select: { title: true } }, unit: { select: { unitNumber: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }
    async updateRequestStatus(requestId, status, notes) {
        return database_1.prisma.propertyMaintenance.update({
            where: { id: requestId },
            data: { status: status.toUpperCase(), notes, ...(status.toUpperCase() === 'COMPLETED' ? { resolvedAt: new Date() } : {}) },
        });
    }
    async assignVendor(requestId, vendorId) {
        const vendor = await database_1.prisma.vendor.findUnique({ where: { id: vendorId } });
        return database_1.prisma.propertyMaintenance.update({
            where: { id: requestId },
            data: { vendorId, vendorName: vendor?.name, status: 'IN_PROGRESS' },
        });
    }
}
exports.HaqMaintenanceService = HaqMaintenanceService;
class HaqCommunicationService {
    async sendMessage(propertyId, senderEmail, recipientEmail, body) {
        return database_1.prisma.propertyMessage.create({
            data: { propertyId, senderEmail, recipientEmail, body, conversationId: `${propertyId}-${recipientEmail}`, mimeType: 'text/plain' },
        });
    }
    async broadcastToTenants(propertyId, message) {
        const tenants = await database_1.prisma.propertyTenant.findMany();
        const messages = tenants.map((t) => database_1.prisma.propertyMessage.create({
            data: { propertyId, senderEmail: 'system', recipientEmail: t.email, body: message, conversationId: `${propertyId}-${t.email}`, mimeType: 'text/plain' },
        }));
        const results = await Promise.allSettled(messages);
        return { success: true, recipientCount: results.filter(r => r.status === 'fulfilled').length };
    }
    async getMessageHistory(conversationId) {
        return database_1.prisma.propertyMessage.findMany({ where: { conversationId }, orderBy: { createdAt: 'desc' }, take: 50 });
    }
}
exports.HaqCommunicationService = HaqCommunicationService;
exports.haqRevenue = new HaqRevenueService();
exports.haqTenant = new HaqTenantService();
exports.haqLease = new HaqLeaseService();
exports.haqMaintenance = new HaqMaintenanceService();
exports.haqCommunication = new HaqCommunicationService();
//# sourceMappingURL=haqOS.service.js.map