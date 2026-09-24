"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.teamService = exports.TeamService = void 0;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
class TeamService {
    /**
     * List all team members for a manager
     */
    async listMembers(managerId) {
        return database_1.prisma.teamMember.findMany({
            where: { managerId },
            include: { user: { select: { id: true, email: true, firstName: true, lastName: true, profilePictureUrl: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }
    /**
     * Invite a new team member
     */
    async invite(managerId, input) {
        const existing = await database_1.prisma.teamMember.findFirst({ where: { managerId, email: input.email } });
        if (existing) {
            throw new Error('Team member already invited');
        }
        const member = await database_1.prisma.teamMember.create({
            data: {
                managerId,
                email: input.email,
                firstName: input.firstName,
                lastName: input.lastName,
                role: input.role,
            },
        });
        // TODO: send invitation email
        logger_1.logger.info(`[Team] Invited ${input.email} to team ${managerId} as ${input.role}`);
        return member;
    }
    /**
     * Update team member role
     */
    async updateRole(managerId, memberId, role) {
        const member = await database_1.prisma.teamMember.findFirst({ where: { id: memberId, managerId } });
        if (!member) {
            throw new Error('Team member not found');
        }
        return database_1.prisma.teamMember.update({
            where: { id: memberId },
            data: { role },
        });
    }
    /**
     * Remove team member
     */
    async remove(managerId, memberId) {
        const member = await database_1.prisma.teamMember.findFirst({ where: { id: memberId, managerId } });
        if (!member) {
            throw new Error('Team member not found');
        }
        await database_1.prisma.teamMember.delete({ where: { id: memberId } });
        return { success: true };
    }
}
exports.TeamService = TeamService;
exports.teamService = new TeamService();
//# sourceMappingURL=team.service.js.map