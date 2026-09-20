import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

export class BuilderService {
  async createProfile(userId: string, data: {
    companyName: string;
    licenseNumber?: string;
  }) {
    const existing = await prisma.builderProfile.findUnique({ where: { userId } });
    if (existing) return existing;

    const profile = await prisma.builderProfile.create({
      data: {
        userId,
        companyName: data.companyName,
        licenseNumber: data.licenseNumber,
      },
    });
    return profile;
  }

  async getProfile(userId: string) {
    return prisma.builderProfile.findUnique({
      where: { userId },
      include: {
        projects: {
          include: {
            _count: { select: { units: true, milestones: true } },
          },
        },
      },
    });
  }

  async createProject(builderId: string, data: {
    name: string;
    location: string;
    description?: string;
    totalUnits: number;
    startDate: Date;
    expectedCompletion: Date;
  }) {
    const project = await prisma.builderProject.create({
      data: {
        builderId,
        name: data.name,
        location: data.location,
        description: data.description,
        totalUnits: data.totalUnits,
        startDate: data.startDate,
        expectedCompletion: data.expectedCompletion,
      },
    });

    await prisma.builderProfile.update({
      where: { id: builderId },
      data: { totalProjects: { increment: 1 } },
    });

    return project;
  }

  async getProjects(builderId: string) {
    return prisma.builderProject.findMany({
      where: { builderId },
      include: {
        _count: { select: { units: true, milestones: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getProjectDetail(projectId: string) {
    return prisma.builderProject.findUnique({
      where: { id: projectId },
      include: {
        units: {
          include: {
            buyer: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
          },
        },
        milestones: { orderBy: { dueDate: 'asc' } },
        builder: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
      },
    });
  }

  async addUnit(projectId: string, data: {
    unitNumber: string;
    type: string;
    size: number;
    price: number;
    floor?: number;
  }) {
    const unit = await prisma.builderUnit.create({
      data: {
        projectId,
        unitNumber: data.unitNumber,
        type: data.type,
        size: data.size,
        price: data.price,
        floor: data.floor,
      },
    });

    await prisma.builderProject.update({
      where: { id: projectId },
      data: { totalUnits: { increment: 1 } },
    });

    return unit;
  }

  async bookUnit(unitId: string, buyerId: string) {
    const unit = await prisma.builderUnit.findUnique({ where: { id: unitId } });
    if (!unit) throw new Error('Unit not found');
    if (unit.status !== 'AVAILABLE') throw new Error('Unit not available');

    const updated = await prisma.builderUnit.update({
      where: { id: unitId },
      data: { status: 'BOOKED', buyerId },
    });

    await prisma.builderProject.update({
      where: { id: unit.projectId },
      data: { bookedUnits: { increment: 1 } },
    });

    return updated;
  }

  async sellUnit(unitId: string, buyerId: string) {
    const unit = await prisma.builderUnit.findUnique({ where: { id: unitId }, include: { project: true } });
    if (!unit) throw new Error('Unit not found');

    const updated = await prisma.builderUnit.update({
      where: { id: unitId },
      data: { status: 'SOLD', buyerId },
    });

    await prisma.builderProject.update({
      where: { id: unit.projectId },
      data: {
        soldUnits: { increment: 1 },
        bookedUnits: { decrement: 1 },
      },
    });

    if (unit.project?.builderId) {
      await prisma.builderProfile.update({
        where: { id: unit.project.builderId },
        data: { totalSold: { increment: 1 } },
      }).catch(() => {});
    }

    return updated;
  }

  async addMilestone(projectId: string, data: {
    title: string;
    description?: string;
    dueDate: Date;
  }) {
    return prisma.builderProjectMilestone.create({
      data: {
        projectId,
        title: data.title,
        description: data.description,
        dueDate: data.dueDate,
      },
    });
  }

  async completeMilestone(milestoneId: string) {
    return prisma.builderProjectMilestone.update({
      where: { id: milestoneId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }

  async getBuyers(builderId: string) {
    const projects = await prisma.builderProject.findMany({
      where: { builderId },
      select: { id: true },
    });
    const projectIds = projects.map((p) => p.id);

    return prisma.buyerProfile.findMany({
      where: { units: { some: { projectId: { in: projectIds } } } },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        units: { where: { projectId: { in: projectIds } } },
        installments: { where: { unit: { projectId: { in: projectIds } } } },
      },
    });
  }

  async getInstallments(builderId: string, status?: string) {
    const projects = await prisma.builderProject.findMany({
      where: { builderId },
      select: { id: true },
    });
    const projectIds = projects.map((p) => p.id);

    const where: any = { unit: { projectId: { in: projectIds } } };
    if (status) where.status = status;

    return prisma.installment.findMany({
      where,
      include: {
        buyer: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        unit: { include: { project: { select: { name: true } } } },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async sendReminder(installmentId: string) {
    const installment = await prisma.installment.findUnique({
      where: { id: installmentId },
      include: {
        buyer: { include: { user: { select: { firstName: true, email: true } } } },
        unit: { include: { project: { select: { name: true } } } },
      },
    });

    if (!installment) throw new Error('Installment not found');
    if (installment.status === 'PAID') throw new Error('Already paid');

    // In production: send SMS/email notification here
    logger.info(`Reminder sent for installment ${installmentId} to ${installment.buyer.user.email}`);
    return { success: true, message: 'Reminder sent' };
  }

  async getTrustScore(builderId: string) {
    const builder = await prisma.builderProfile.findUnique({
      where: { id: builderId },
      include: {
        projects: {
          include: {
            milestones: true,
            units: true,
          },
        },
      },
    });

    if (!builder) throw new Error('Builder not found');

    const totalMilestones = builder.projects.reduce((sum, p) => sum + p.milestones.length, 0);
    const completedMilestones = builder.projects.reduce(
      (sum, p) => sum + p.milestones.filter((m) => m.status === 'COMPLETED').length,
      0
    );
    const totalUnits = builder.projects.reduce((sum, p) => sum + p.units.length, 0);
    const soldUnits = builder.projects.reduce((sum, p) => sum + p.units.filter((u) => u.status === 'SOLD').length, 0);

    const milestoneRate = totalMilestones > 0 ? completedMilestones / totalMilestones : 0.5;
    const salesRate = totalUnits > 0 ? soldUnits / totalUnits : 0;
    const baseScore = (milestoneRate * 0.4 + salesRate * 0.3 + (builder.verified ? 0.3 : 0)) * 100;

    return {
      score: Math.min(100, Math.max(0, baseScore)),
      verified: builder.verified,
      totalProjects: builder.projects.length,
      totalUnits,
      soldUnits,
      completedMilestones,
      totalMilestones,
    };
  }

  async searchProjects(filters: {
    location?: string;
    priceMin?: number;
    priceMax?: number;
    type?: string;
  }) {
    const where: any = { status: 'ACTIVE' };
    
    if (filters.location) {
      where.location = { contains: filters.location, mode: 'insensitive' };
    }
    if (filters.type) {
      where.units = { some: { type: filters.type } };
    }
    if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
      where.units = {
        ...where.units,
        some: {
          ...(where.units?.some || {}),
          price: {
            ...(filters.priceMin !== undefined ? { gte: filters.priceMin } : {}),
            ...(filters.priceMax !== undefined ? { lte: filters.priceMax } : {}),
          },
        },
      };
    }

    return prisma.builderProject.findMany({
      where,
      include: {
        builder: { include: { user: { select: { firstName: true, lastName: true } } } },
        units: {
          where: filters.type ? { type: filters.type } : undefined,
          orderBy: { price: 'asc' },
          take: 5,
        },
        _count: { select: { units: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const builderService = new BuilderService();
