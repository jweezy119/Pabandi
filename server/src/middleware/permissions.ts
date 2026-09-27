import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

const roleHierarchy: Record<Role, number> = {
  VIEWER: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4
};

export const requireRole = (minRole: Role) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const businessId = req.query.businessId || req.body.businessId;
      if (!businessId) {
        return res.status(400).json({ error: 'businessId is required for permission check' });
      }

      const email = req.user?.email;
      if (!email) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Check if user is the business owner
      const business = await prisma.business.findUnique({ where: { id: String(businessId) } });
      if (business?.ownerId === req.user?.id) {
        return next(); // Owner has all permissions
      }

      // Or check if user is a team member with adequate role
      const member = await prisma.crmEmployee.findFirst({
        where: { businessId: String(businessId), email }
      });

      if (!member || !member.isActive) {
        return res.status(403).json({ error: 'Access denied: not an active team member' });
      }

      const userRole = member.role.toUpperCase() as Role;
      if ((roleHierarchy[userRole] || 0) < roleHierarchy[minRole]) {
        return res.status(403).json({ error: `Access denied: requires ${minRole} role` });
      }

      next();
    } catch (err) {
      console.error('Permission check failed:', err);
      res.status(500).json({ error: 'Internal server error during permission check' });
    }
  };
};
