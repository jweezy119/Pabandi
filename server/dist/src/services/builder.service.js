"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.builderService = exports.BuilderService = void 0;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
class BuilderService {
    async createProfile(userId, data) {
        const existing = await database_1.prisma.abodeBuilder.findUnique({ where: { userId } });
        if (existing)
            return existing;
        const profile = await database_1.prisma.abodeBuilder.create({
            data: {
                userId,
                companyName: data.companyName,
                licenseNumber: data.licenseNumber,
            },
        });
        return profile;
    }
    async getProfile(userId) {
        return database_1.prisma.abodeBuilder.findUnique({
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
    async createProject(builderId, data) {
        const project = await database_1.prisma.abodeProject.create({
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
        await database_1.prisma.abodeBuilder.update({
            where: { id: builderId },
            data: { totalProjects: { increment: 1 } },
        });
        return project;
    }
    async getProjects(builderId) {
        return database_1.prisma.abodeProject.findMany({
            where: { builderId },
            include: {
                _count: { select: { units: true, milestones: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getProjectDetail(projectId) {
        return database_1.prisma.abodeProject.findUnique({
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
    async addUnit(projectId, data) {
        const unit = await database_1.prisma.abodeBuilderUnit.create({
            data: {
                projectId,
                unitNumber: data.unitNumber,
                type: data.type,
                size: data.size,
                price: data.price,
                floor: data.floor,
            },
        });
        await database_1.prisma.abodeProject.update({
            where: { id: projectId },
            data: { totalUnits: { increment: 1 } },
        });
        return unit;
    }
    async bookUnit(unitId, buyerId) {
        const unit = await database_1.prisma.abodeBuilderUnit.findUnique({ where: { id: unitId } });
        if (!unit)
            throw new Error('Unit not found');
        if (unit.status !== 'AVAILABLE')
            throw new Error('Unit not available');
        const updated = await database_1.prisma.abodeBuilderUnit.update({
            where: { id: unitId },
            data: { status: 'BOOKED', buyerId },
        });
        await database_1.prisma.abodeProject.update({
            where: { id: unit.projectId },
            data: { bookedUnits: { increment: 1 } },
        });
        return updated;
    }
    async sellUnit(unitId, buyerId) {
        const unit = await database_1.prisma.abodeBuilderUnit.findUnique({ where: { id: unitId }, include: { project: true } });
        if (!unit)
            throw new Error('Unit not found');
        const updated = await database_1.prisma.abodeBuilderUnit.update({
            where: { id: unitId },
            data: { status: 'SOLD', buyerId },
        });
        await database_1.prisma.abodeProject.update({
            where: { id: unit.projectId },
            data: {
                soldUnits: { increment: 1 },
                bookedUnits: { decrement: 1 },
            },
        });
        if (unit.project?.builderId) {
            await database_1.prisma.abodeBuilder.update({
                where: { id: unit.project.builderId },
                data: { totalSold: { increment: 1 } },
            }).catch(() => { });
        }
        return updated;
    }
    async addMilestone(projectId, data) {
        return database_1.prisma.builderProjectMilestone.create({
            data: {
                projectId,
                title: data.title,
                description: data.description,
                dueDate: data.dueDate,
            },
        });
    }
    async completeMilestone(milestoneId) {
        return database_1.prisma.builderProjectMilestone.update({
            where: { id: milestoneId },
            data: { status: 'COMPLETED', completedAt: new Date() },
        });
    }
    async getBuyers(builderId) {
        const projects = await database_1.prisma.abodeProject.findMany({
            where: { builderId },
            select: { id: true },
        });
        const projectIds = projects.map((p) => p.id);
        return database_1.prisma.abodeBuyer.findMany({
            where: { units: { some: { projectId: { in: projectIds } } } },
            include: {
                user: { select: { firstName: true, lastName: true, email: true } },
                units: { where: { projectId: { in: projectIds } } },
                installments: { where: { unit: { projectId: { in: projectIds } } } },
            },
        });
    }
    async getInstallments(builderId, status) {
        const projects = await database_1.prisma.abodeProject.findMany({
            where: { builderId },
            select: { id: true },
        });
        const projectIds = projects.map((p) => p.id);
        const where = { unit: { projectId: { in: projectIds } } };
        if (status)
            where.status = status;
        return database_1.prisma.installment.findMany({
            where,
            include: {
                buyer: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
                unit: { include: { project: { select: { name: true } } } },
            },
            orderBy: { dueDate: 'asc' },
        });
    }
    async sendReminder(installmentId) {
        const installment = await database_1.prisma.installment.findUnique({
            where: { id: installmentId },
            include: {
                buyer: { include: { user: { select: { firstName: true, email: true } } } },
                unit: { include: { project: { select: { name: true } } } },
            },
        });
        if (!installment)
            throw new Error('Installment not found');
        if (installment.status === 'PAID')
            throw new Error('Already paid');
        // In production: send SMS/email notification here
        logger_1.logger.info(`Reminder sent for installment ${installmentId} to ${installment.buyer.user.email}`);
        return { success: true, message: 'Reminder sent' };
    }
    async getTrustScore(builderId) {
        const builder = await database_1.prisma.abodeBuilder.findUnique({
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
        if (!builder)
            throw new Error('Builder not found');
        const totalMilestones = builder.projects.reduce((sum, p) => sum + p.milestones.length, 0);
        const completedMilestones = builder.projects.reduce((sum, p) => sum + p.milestones.filter((m) => m.status === 'COMPLETED').length, 0);
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
    async searchProjects(filters) {
        const where = { status: 'ACTIVE' };
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
        return database_1.prisma.abodeProject.findMany({
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
exports.BuilderService = BuilderService;
exports.builderService = new BuilderService();
//# sourceMappingURL=builder.service.js.map