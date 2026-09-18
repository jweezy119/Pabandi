import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

export type TeamMemberInvite = {
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'AGENT' | 'MEMBER' | 'VIEWER';
};

export class TeamService {
  /**
   * List all team members for a manager
   */
  async listMembers(managerId: string) {
    return prisma.teamMember.findMany({
      where: { managerId },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, profilePictureUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Invite a new team member
   */
  async invite(managerId: string, input: TeamMemberInvite) {
    const existing = await prisma.teamMember.findFirst({ where: { managerId, email: input.email } });
    if (existing) {
      throw new Error('Team member already invited');
    }

    const member = await prisma.teamMember.create({
      data: {
        managerId,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role,
      },
    });

    // TODO: send invitation email
    logger.info(`[Team] Invited ${input.email} to team ${managerId} as ${input.role}`);

    return member;
  }

  /**
   * Update team member role
   */
  async updateRole(managerId: string, memberId: string, role: string) {
    const member = await prisma.teamMember.findFirst({ where: { id: memberId, managerId } });
    if (!member) {
      throw new Error('Team member not found');
    }

    return prisma.teamMember.update({
      where: { id: memberId },
      data: { role },
    });
  }

  /**
   * Remove team member
   */
  async remove(managerId: string, memberId: string) {
    const member = await prisma.teamMember.findFirst({ where: { id: memberId, managerId } });
    if (!member) {
      throw new Error('Team member not found');
    }

    await prisma.teamMember.delete({ where: { id: memberId } });
    return { success: true };
  }
}

export const teamService = new TeamService();
