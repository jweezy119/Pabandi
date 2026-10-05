import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export class TeamService {
  static async getTeamMembers(businessId: string) {
    return prisma.crmEmployee.findMany({
      where: { businessId },
      include: {
        jobs: { select: { id: true, title: true, status: true, deliveryScore: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getTeamMember(id: string, businessId: string) {
    return prisma.crmEmployee.findFirst({
      where: { id, businessId },
      include: {
        jobs: true
      }
    });
  }

  static async inviteMember(data: { businessId: string; name: string; email: string; role: string; payRate?: number; payType?: string }) {
    const token = crypto.randomBytes(32).toString('hex');
    
    return prisma.crmEmployee.create({
      data: {
        businessId: data.businessId,
        name: data.name,
        email: data.email,
        role: data.role,
        payRate: data.payRate || 0,
        payType: data.payType || 'HOURLY',
        inviteToken: token,
        inviteStatus: 'PENDING',
        isActive: true,
        // `reliabilityScore` is deliberately omitted.
        //
        // It used to be written here as 100 — the TOP of the 0–100 scale — for
        // an employee who had not started work. There is a defensible argument
        // that "no history yet" should read as perfect for a tool that is simply
        // unmeasured. But this number is shown to customers and read by
        // job-assignment logic, so a flattering blank beats an honest one.
        // The column default is COLD_START_SCORE (50), which is neutral.
        //
        // `deliveryScore` keeps its 100: that is a different field with its own
        // documented 0–1000 scale, and 500 is already its midpoint default, so
        // it is not the same class of claim.
        deliveryScore: 100
      }
    });
  }

  static async updateMember(id: string, businessId: string, data: any) {
    return prisma.crmEmployee.update({
      where: { id },
      data: {
        ...data
      }
    });
  }

  static async removeMember(id: string, businessId: string) {
    // Soft delete
    return prisma.crmEmployee.update({
      where: { id },
      data: {
        isActive: false
      }
    });
  }

  static async acceptInvite(token: string) {
    const member = await prisma.crmEmployee.findUnique({ where: { inviteToken: token } });
    if (!member) throw new Error('Invalid or expired invite token');

    return prisma.crmEmployee.update({
      where: { id: member.id },
      data: {
        inviteStatus: 'ACCEPTED',
        inviteToken: null // One-time use
      }
    });
  }
}
