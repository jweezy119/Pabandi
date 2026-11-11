import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export type CoordinatorRole = 'OWNER' | 'COORDINATOR' | 'TECHNICIAN';

/**
 * Normalize system roles into the 3 Service Coordinator roles:
 * OWNER, COORDINATOR, TECHNICIAN.
 */
export function resolveCoordinatorRole(userRole?: string): CoordinatorRole {
  const norm = String(userRole || '').toUpperCase();
  if (norm === 'TECHNICIAN') return 'TECHNICIAN';
  if (norm === 'COORDINATOR' || norm === 'DISPATCHER' || norm === 'STAFF') return 'COORDINATOR';
  // Default business owner / admin / merchant owner to OWNER
  return 'OWNER';
}

/**
 * Route-level role enforcement middleware.
 */
export function requireCoordinatorRole(allowedRoles: CoordinatorRole[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (!req.user.businessId) {
      // Fallback: resolve user's owned business from DB if session token lacked businessId
      const biz = await prisma.business.findFirst({
        where: { ownerId: req.user.id },
        select: { id: true },
      });
      if (biz) {
        req.user.businessId = biz.id;
      } else {
        const crmBiz = await prisma.crmServiceBusiness.findFirst({
          where: { ownerId: req.user.id },
          select: { businessId: true, id: true },
        });
        if (crmBiz?.businessId) {
          req.user.businessId = crmBiz.businessId;
        } else if (crmBiz?.id) {
          req.user.businessId = crmBiz.id;
        }
      }
    }

    if (!req.user.businessId) {
      return res.status(403).json({ success: false, error: 'Tenant isolation error: No active businessId found in session' });
    }

    const effectiveRole = resolveCoordinatorRole(req.user.role);

    if (!allowedRoles.includes(effectiveRole)) {
      logger.warn(`[RBAC] Access denied for user ${req.user.id} with role ${effectiveRole} on ${req.method} ${req.originalUrl}`);
      return res.status(403).json({
        success: false,
        error: `Insufficient permissions. Role '${effectiveRole}' cannot perform this action.`,
      });
    }

    // Role-specific granular checks:
    // If TECHNICIAN is accessing a specific work order, verify assignment
    if (effectiveRole === 'TECHNICIAN' && req.params.id) {
      const workOrderId = req.params.id;
      const technician = await prisma.technician.findFirst({
        where: {
          businessId: req.user.businessId,
          OR: [
            { id: req.user.id },
            { name: { contains: req.user.firstName || req.user.email, mode: 'insensitive' } },
          ],
        },
      });

      if (!technician) {
        return res.status(403).json({
          success: false,
          error: 'Technician profile not found for this account',
        });
      }

      const assignment = await prisma.workOrderAssignment.findFirst({
        where: {
          workOrderId,
          technicianId: technician.id,
        },
      });

      if (!assignment) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You are not assigned to this work order',
        });
      }

      // Attach technician context to request
      (req as any).technician = technician;
    }

    // Coordinator restriction: cannot change billing / delete customers
    if (effectiveRole === 'COORDINATOR') {
      if (req.method === 'DELETE' && req.originalUrl.includes('/customers')) {
        return res.status(403).json({
          success: false,
          error: 'Coordinators cannot delete customers. Owner approval required.',
        });
      }
      if (req.body && req.body.invoiceStatus && req.body.invoiceStatus === 'PAID') {
        return res.status(403).json({
          success: false,
          error: 'Coordinators cannot mark invoices as PAID. Finance/Owner permission required.',
        });
      }
    }

    (req as any).coordinatorRole = effectiveRole;
    next();
  };
}

