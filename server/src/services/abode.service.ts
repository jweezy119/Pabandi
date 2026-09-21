import { prisma } from '../utils/database';

export class AbodeRevenueService {
  async getRevenueSummary(managerId: string, period: 'week' | 'month' | 'year') {
    const now = new Date();
    const startDate = new Date();
    if (period === 'week') startDate.setDate(now.getDate() - 7);
    else if (period === 'month') startDate.setMonth(now.getMonth() - 1);
    else startDate.setFullYear(now.getFullYear() - 1);

    const payments = await prisma.propertyFinancial.findMany({
      where: { property: { managerId }, type: 'INCOME', date: { gte: startDate } },
    });

    const totalRevenue = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const expenses = await prisma.propertyFinancial.findMany({
      where: { property: { managerId }, type: 'EXPENSE', date: { gte: startDate } },
    });
    const totalExpenses = expenses.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    return {
      period,
      totalRevenue,
      totalExpenses,
      netIncome: totalRevenue - totalExpenses,
      paymentCount: payments.length,
      averagePayment: payments.length > 0 ? totalRevenue / payments.length : 0,
    };
  }

  async getRentCollectionRate(managerId: string) {
    const totalTenants = await prisma.propertyTenant.count({ where: { managerId } });
    const paidTenants = await prisma.propertyTenant.count({ where: { managerId, totalStays: { gt: 0 } } });
    return {
      totalTenants,
      paidTenants,
      collectionRate: totalTenants > 0 ? (paidTenants / totalTenants) * 100 : 0,
    };
  }

  async getTopProperties(managerId: string) {
    return prisma.propertyManagerProperty.findMany({
      where: { managerId },
      select: { id: true, title: true, address: true, rentAmount: true, status: true, _count: { select: { units: true } } },
      orderBy: { rentAmount: 'desc' },
      take: 5,
    });
  }
}

export class AbodeTenantService {
  async getTenants(managerId: string) {
    const tenants = await prisma.propertyTenant.findMany({
      where: { managerId },
      orderBy: { createdAt: 'desc' },
    });
    return tenants;
  }

  async getTenantDetail(tenantId: string) {
    const tenant = await prisma.propertyTenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return null;
    const leases = await prisma.propertyLease.findMany({ where: { tenantEmail: tenant.email }, orderBy: { createdAt: 'desc' } });
    const maintenance = await prisma.propertyMaintenance.findMany({ where: { tenantEmail: tenant.email }, orderBy: { createdAt: 'desc' } });
    const payments = await prisma.propertyFinancial.findMany({ where: { tenantEmail: tenant.email, type: 'INCOME' }, orderBy: { date: 'desc' }, take: 12 });
    return { ...tenant, leases, maintenanceRequests: maintenance, paymentHistory: payments };
  }

  async updateTenantRisk(tenantId: string, riskBand: string) {
    return prisma.propertyTenant.update({ where: { id: tenantId }, data: { riskBand } });
  }
}

export class AbodeLeaseService {
  async getLeases(managerId: string, status?: string) {
    const where: any = { managerId };
    if (status) where.status = status;
    return prisma.propertyLease.findMany({
      where,
      include: { property: { select: { title: true, address: true } }, unit: { select: { unitNumber: true } } },
      orderBy: { endDate: 'asc' },
    });
  }

  async createLease(data: any) {
    return prisma.propertyLease.create({ data: { ...data, status: 'DRAFT' } });
  }

  async renewLease(leaseId: string, data: { endDate: Date; rentAmount?: number }) {
    return prisma.propertyLease.update({
      where: { id: leaseId },
      data: { endDate: data.endDate, rentAmount: data.rentAmount || undefined, status: 'ACTIVE' },
    });
  }

  async terminateLease(leaseId: string, reason?: string) {
    return prisma.propertyLease.update({ where: { id: leaseId }, data: { status: 'TERMINATED', notes: reason } });
  }
}

export class AbodeMaintenanceService {
  async submitRequest(tenantId: string, data: { category: string; description: string; priority: string; photos?: string[] }) {
    const tenant = await prisma.propertyTenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error('Tenant not found');
    return prisma.propertyMaintenance.create({
      data: { managerId: tenant.managerId, tenantEmail: tenant.email, title: data.category, description: data.description, priority: data.priority.toUpperCase(), status: 'OPEN' },
    });
  }

  async getRequests(managerId: string, status?: string) {
    const where: any = { managerId };
    if (status) where.status = status.toUpperCase();
    return prisma.propertyMaintenance.findMany({
      where,
      include: { property: { select: { title: true } }, unit: { select: { unitNumber: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateRequestStatus(requestId: string, status: string, notes?: string) {
    return prisma.propertyMaintenance.update({
      where: { id: requestId },
      data: { status: status.toUpperCase(), notes, ...(status.toUpperCase() === 'COMPLETED' ? { resolvedAt: new Date() } : {}) },
    });
  }

  async assignVendor(requestId: string, vendorId: string) {
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    return prisma.propertyMaintenance.update({
      where: { id: requestId },
      data: { vendorId, vendorName: vendor?.name, status: 'IN_PROGRESS' },
    });
  }
}

export class AbodeCommunicationService {
  async sendMessage(propertyId: string, senderEmail: string, recipientEmail: string, body: string) {
    return prisma.propertyMessage.create({
      data: { propertyId, senderEmail, recipientEmail, body, conversationId: `${propertyId}-${recipientEmail}`, mimeType: 'text/plain' },
    });
  }

  async broadcastToTenants(propertyId: string, message: string) {
    const tenants = await prisma.propertyTenant.findMany();
    const messages = tenants.map((t: any) =>
      prisma.propertyMessage.create({
        data: { propertyId, senderEmail: 'system', recipientEmail: t.email, body: message, conversationId: `${propertyId}-${t.email}`, mimeType: 'text/plain' },
      })
    );
    const results = await Promise.allSettled(messages);
    return { success: true, recipientCount: results.filter(r => r.status === 'fulfilled').length };
  }

  async getMessageHistory(conversationId: string) {
    return prisma.propertyMessage.findMany({ where: { conversationId }, orderBy: { createdAt: 'desc' }, take: 50 });
  }
}

export const abodeRevenue = new AbodeRevenueService();
export const abodeTenant = new AbodeTenantService();
export const abodeLease = new AbodeLeaseService();
export const abodeMaintenance = new AbodeMaintenanceService();
export const abodeCommunication = new AbodeCommunicationService();
