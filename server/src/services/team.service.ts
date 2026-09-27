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
        reliabilityScore: 100,
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
