export type TeamMemberInvite = {
    email: string;
    firstName?: string;
    lastName?: string;
    role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'AGENT' | 'MEMBER' | 'VIEWER';
};
export declare class TeamService {
    /**
     * List all team members for a manager
     */
    listMembers(managerId: string): Promise<({
        user: {
            email: string;
            id: string;
            firstName: string;
            lastName: string;
            profilePictureUrl: string | null;
        } | null;
    } & {
        email: string;
        role: string;
        id: string;
        firstName: string | null;
        lastName: string | null;
        createdAt: Date;
        updatedAt: Date;
        userId: string | null;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        isActive: boolean;
        managerId: string;
        joinedAt: Date | null;
        permissions: import("@prisma/client/runtime/library").JsonValue | null;
        invitedAt: Date;
        lastActiveAt: Date | null;
    })[]>;
    /**
     * Invite a new team member
     */
    invite(managerId: string, input: TeamMemberInvite): Promise<{
        email: string;
        role: string;
        id: string;
        firstName: string | null;
        lastName: string | null;
        createdAt: Date;
        updatedAt: Date;
        userId: string | null;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        isActive: boolean;
        managerId: string;
        joinedAt: Date | null;
        permissions: import("@prisma/client/runtime/library").JsonValue | null;
        invitedAt: Date;
        lastActiveAt: Date | null;
    }>;
    /**
     * Update team member role
     */
    updateRole(managerId: string, memberId: string, role: string): Promise<{
        email: string;
        role: string;
        id: string;
        firstName: string | null;
        lastName: string | null;
        createdAt: Date;
        updatedAt: Date;
        userId: string | null;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        isActive: boolean;
        managerId: string;
        joinedAt: Date | null;
        permissions: import("@prisma/client/runtime/library").JsonValue | null;
        invitedAt: Date;
        lastActiveAt: Date | null;
    }>;
    /**
     * Remove team member
     */
    remove(managerId: string, memberId: string): Promise<{
        success: boolean;
    }>;
}
export declare const teamService: TeamService;
//# sourceMappingURL=team.service.d.ts.map