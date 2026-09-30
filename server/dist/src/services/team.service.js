"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamService = void 0;
const client_1 = require("@prisma/client");
const crypto_1 = __importDefault(require("crypto"));
const prisma = new client_1.PrismaClient();
class TeamService {
    static async getTeamMembers(businessId) {
        return prisma.crmEmployee.findMany({
            where: { businessId },
            include: {
                jobs: { select: { id: true, title: true, status: true, deliveryScore: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
    static async getTeamMember(id, businessId) {
        return prisma.crmEmployee.findFirst({
            where: { id, businessId },
            include: {
                jobs: true
            }
        });
    }
    static async inviteMember(data) {
        const token = crypto_1.default.randomBytes(32).toString('hex');
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
    static async updateMember(id, businessId, data) {
        return prisma.crmEmployee.update({
            where: { id },
            data: {
                ...data
            }
        });
    }
    static async removeMember(id, businessId) {
        // Soft delete
        return prisma.crmEmployee.update({
            where: { id },
            data: {
                isActive: false
            }
        });
    }
    static async acceptInvite(token) {
        const member = await prisma.crmEmployee.findUnique({ where: { inviteToken: token } });
        if (!member)
            throw new Error('Invalid or expired invite token');
        return prisma.crmEmployee.update({
            where: { id: member.id },
            data: {
                inviteStatus: 'ACCEPTED',
                inviteToken: null // One-time use
            }
        });
    }
}
exports.TeamService = TeamService;
//# sourceMappingURL=team.service.js.map