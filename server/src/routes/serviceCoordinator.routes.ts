import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { idempotency } from '../middleware/idempotency.middleware';
import { requireCoordinatorRole, resolveCoordinatorRole } from '../middleware/serviceCoordinatorRole.middleware';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { encryptPii, decryptPii, maskPhone, maskAddress } from '../utils/pii';
import { recordWorkOrderAudit } from '../services/workOrderAudit.service';
import { sendTechnicianDispatchWhatsApp } from '../services/serviceCoordinatorWhatsApp.service';
import { generateDispatchTriage } from '../services/serviceCoordinatorAi.service';
import {
  createWorkOrderSchema,
  updateWorkOrderSchema,
  assignWorkOrderSchema,
  unassignWorkOrderSchema,
  completeWorkOrderSchema,
  createAttachmentSchema,
  createTechnicianSchema,
  createCustomerSchema,
  aiTriageSchema,
  simulateRiskSchema,
} from '../validators/serviceCoordinator.validator';
import {
  predictRiskForWorkOrders,
  predictWorkOrderRisk,
  simulateWorkOrderRisk,
  toWorkOrderLike,
} from '../services/predictiveEngine.service';

const router = Router();

// Apply authentication to all coordinator routes
router.use(authenticate);

// ── Rate Limiting for AI Triage (Max 20 dispatches/hour per user) ───────────
const aiRateLimitMap = new Map<string, { count: number; resetAt: number }>();
function aiTriageRateLimit(req: AuthRequest, res: Response, next: () => void) {
  const userId = req.user?.id || 'anon';
  const now = Date.now();
  const entry = aiRateLimitMap.get(userId) || { count: 0, resetAt: now + 3600000 };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + 3600000;
  }

  if (entry.count >= 20) {
    const minutesLeft = Math.ceil((entry.resetAt - now) / 60000);
    return res.status(429).json({
      success: false,
      error: `AI Triage rate limit exceeded (max 20 dispatches/hr). Try again in ${minutesLeft} minutes.`,
    });
  }

  entry.count++;
  aiRateLimitMap.set(userId, entry);
  next();
}

/**
 * The what-if simulation runs 200 bootstrap draws per request, so it is the
 * expensive endpoint and the one that needs a ceiling. Generous relative to
 * triage: a coordinator dragging a slider should not hit it, but a client
 * looping on it should.
 */
const predictiveRateLimitMap = new Map<string, { count: number; resetAt: number }>();
function predictiveRateLimit(req: AuthRequest, res: Response, next: () => void) {
  const userId = req.user?.id || 'anon';
  const now = Date.now();
  const entry = predictiveRateLimitMap.get(userId) || { count: 0, resetAt: now + 3600000 };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + 3600000;
  }

  if (entry.count >= 60) {
    const minutesLeft = Math.ceil((entry.resetAt - now) / 60000);
    return res.status(429).json({
      success: false,
      error: `Too many what-if simulations. Try again in ${minutesLeft} minutes.`,
    });
  }

  entry.count++;
  predictiveRateLimitMap.set(userId, entry);
  next();
}

/**
 * GET /api/v1/coordinator/work-orders
 * List work orders scoped strictly by authenticated session businessId.
 * Technicians see only their assigned work orders.
 */
router.get('/work-orders', requireCoordinatorRole(['OWNER', 'COORDINATOR', 'TECHNICIAN']), async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.businessId!;
    const role = resolveCoordinatorRole(req.user?.role);
    const { status, priority, issueType, search } = req.query;

    const whereClause: any = {
      businessId,
      ...(status && status !== 'all' ? { status: String(status) } : {}),
      ...(priority && priority !== 'all' ? { priority: String(priority) } : {}),
      ...(issueType && issueType !== 'all' ? { issueType: String(issueType) } : {}),
      ...(search ? {
        OR: [
          { address: { contains: String(search), mode: 'insensitive' } },
          { description: { contains: String(search), mode: 'insensitive' } },
        ],
      } : {}),
    };

    // If technician, filter only to their assigned work orders
    if (role === 'TECHNICIAN') {
      const tech = await prisma.technician.findFirst({
        where: {
          businessId,
          OR: [
            { id: req.user!.id },
            { name: { contains: req.user!.firstName || req.user!.email, mode: 'insensitive' } },
          ],
        },
      });

      if (!tech) {
        return res.json({ success: true, data: [] });
      }

      whereClause.assignments = {
        some: { technicianId: tech.id },
      };
    }

    const workOrders = await prisma.workOrder.findMany({
      where: whereClause,
      include: {
        customer: { select: { id: true, name: true, phoneEncrypted: true, address: true } },
        assignments: {
          include: {
            technician: {
              select: {
                id: true,
                name: true,
                skills: true,
                active: true,
                experienceYears: true,
              },
            },
          },
        },
        attachments: { select: { id: true, kind: true, url: true, createdAt: true } },
        _count: { select: { auditLog: true } },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 100,
    });

    // Risk scores in one pass. The engine loads the business's same-day loads
    // and per-technician history once for the page rather than once per row.
    const settings = await prisma.businessSettings.findUnique({
      where: { businessId },
      select: { vertical: true },
    });

    const riskById = await predictRiskForWorkOrders(
      workOrders.map((wo: any) => toWorkOrderLike(wo, wo.assignments[0]?.technician ?? null)),
      businessId,
      settings?.vertical ?? null,
    );

    // Mask phone numbers in response for PII protection
    const sanitized = workOrders.map((wo: any) => ({
      ...wo,
      risk: riskById.get(wo.id) ?? null,
      customer: wo.customer ? {
        ...wo.customer,
        phoneMasked: maskPhone(decryptPii(wo.customer.phoneEncrypted || '')),
        addressMasked: maskAddress(wo.customer.address || wo.address),
      } : null,
    }));

    res.json({ success: true, data: sanitized });
  } catch (err: any) {
    logger.error('[ServiceCoordinator] list work orders failed:', err.message);
    res.status(500).json({ success: false, error: 'Could not fetch work orders' });
  }
});

/**
 * POST /api/v1/coordinator/work-orders
 * Create new commercial work order (OWNER / COORDINATOR only).
 */
router.post('/work-orders', idempotency, requireCoordinatorRole(['OWNER', 'COORDINATOR']), async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.businessId!;
    const validation = createWorkOrderSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.error.format(),
      });
    }

    const { customerId, issueType, priority, description, address, accessNotes, scheduledFor } = validation.data;

    // Verify customer belongs to this business
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId },
    });
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found for this business' });
    }

    const workOrder = await prisma.workOrder.create({
      data: {
        businessId,
        customerId,
        issueType,
        priority,
        description,
        address,
        accessNotes: accessNotes || null,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        status: 'PENDING_ASSIGNMENT',
        createdById: req.user!.id,
      },
      include: {
        customer: true,
      },
    });

    const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`;
    await recordWorkOrderAudit({
      workOrderId: workOrder.id,
      actorId: req.user!.id,
      action: 'CREATED',
      after: { id: workOrder.id, priority, issueType, address },
      requestId,
    });

    res.status(201).json({ success: true, data: workOrder });
  } catch (err: any) {
    logger.error('[ServiceCoordinator] create work order failed:', err.message);
    res.status(500).json({ success: false, error: 'Could not create work order' });
  }
});

/**
 * GET /api/v1/coordinator/work-orders/:id
 * Retrieve work order detail with assignment and audit trail.
 */
router.get('/work-orders/:id', requireCoordinatorRole(['OWNER', 'COORDINATOR', 'TECHNICIAN']), async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.businessId!;
    const workOrder = await prisma.workOrder.findFirst({
      where: { id: req.params.id, businessId },
      include: {
        customer: true,
        assignments: {
          include: { technician: true },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
        },
        auditLog: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!workOrder) {
      return res.status(404).json({ success: false, error: 'Work order not found' });
    }

    // Decrypt phone for authorized coordinators / owners, mask for technicians
    const role = resolveCoordinatorRole(req.user?.role);
    const rawCustomerPhone = decryptPii(workOrder.customer?.phoneEncrypted || '');

    const sanitized = {
      ...workOrder,
      customer: workOrder.customer ? {
        ...workOrder.customer,
        phone: role === 'TECHNICIAN' ? maskPhone(rawCustomerPhone) : rawCustomerPhone,
        phoneMasked: maskPhone(rawCustomerPhone),
        phoneEncrypted: undefined, // Never expose encrypted blob
      } : null,
    };

    res.json({ success: true, data: sanitized });
  } catch (err: any) {
    logger.error('[ServiceCoordinator] get work order failed:', err.message);
    res.status(500).json({ success: false, error: 'Could not fetch work order details' });
  }
});

/**
 * PATCH /api/v1/coordinator/work-orders/:id
 * Update status or metadata on work order.
 */
router.patch('/work-orders/:id', idempotency, requireCoordinatorRole(['OWNER', 'COORDINATOR', 'TECHNICIAN']), async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.businessId!;
    const validation = updateWorkOrderSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: validation.error.format() });
    }

    const current = await prisma.workOrder.findFirst({
      where: { id: req.params.id, businessId },
    });
    if (!current) {
      return res.status(404).json({ success: false, error: 'Work order not found' });
    }

    const updateData: any = { ...validation.data };
    if (updateData.scheduledFor) updateData.scheduledFor = new Date(updateData.scheduledFor);
    if (updateData.status === 'COMPLETED' && !current.completedAt) {
      updateData.completedAt = new Date();
    }

    const updated = await prisma.workOrder.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        customer: true,
        assignments: { include: { technician: true } },
      },
    });

    const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`;
    await recordWorkOrderAudit({
      workOrderId: updated.id,
      actorId: req.user!.id,
      action: 'STATUS_CHANGE',
      before: { status: current.status, priority: current.priority, invoiceStatus: current.invoiceStatus },
      after: { status: updated.status, priority: updated.priority, invoiceStatus: updated.invoiceStatus },
      requestId,
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    logger.error('[ServiceCoordinator] update work order failed:', err.message);
    res.status(500).json({ success: false, error: 'Could not update work order' });
  }
});

/**
 * POST /api/v1/coordinator/work-orders/:id/assign
 * Assign technician to work order and dispatch compliant WhatsApp utility notification.
 */
router.post('/work-orders/:id/assign', idempotency, requireCoordinatorRole(['OWNER', 'COORDINATOR']), async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.businessId!;
    const validation = assignWorkOrderSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: validation.error.format() });
    }

    const { technicianId, notifyWhatsApp } = validation.data;

    const [workOrder, technician] = await Promise.all([
      prisma.workOrder.findFirst({ where: { id: req.params.id, businessId } }),
      prisma.technician.findFirst({ where: { id: technicianId, businessId } }),
    ]);

    if (!workOrder) return res.status(404).json({ success: false, error: 'Work order not found' });
    if (!technician) return res.status(404).json({ success: false, error: 'Technician not found' });
    if (!technician.active) return res.status(400).json({ success: false, error: 'Cannot assign inactive technician' });

    // Upsert assignment
    const assignment = await prisma.workOrderAssignment.upsert({
      where: {
        workOrderId_technicianId: {
          workOrderId: workOrder.id,
          technicianId: technician.id,
        },
      },
      update: {
        assignedAt: new Date(),
        declinedAt: null,
      },
      create: {
        workOrderId: workOrder.id,
        technicianId: technician.id,
        assignedAt: new Date(),
      },
    });

    // Update work order status to ASSIGNED if currently pending
    const updatedWorkOrder = await prisma.workOrder.update({
      where: { id: workOrder.id },
      data: {
        status: workOrder.status === 'PENDING_ASSIGNMENT' || workOrder.status === 'DRAFT' ? 'ASSIGNED' : workOrder.status,
      },
    });

    const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`;
    await recordWorkOrderAudit({
      workOrderId: workOrder.id,
      actorId: req.user!.id,
      action: 'TECHNICIAN_ASSIGNED',
      after: { technicianId: technician.id, technicianName: technician.name },
      requestId,
    });

    // Outbound WhatsApp dispatch (Utility template only)
    let whatsAppResult = null;
    if (notifyWhatsApp) {
      const rawTechPhone = decryptPii(technician.phoneEncrypted);
      whatsAppResult = await sendTechnicianDispatchWhatsApp({
        technicianName: technician.name,
        technicianPhone: rawTechPhone,
        workOrderId: workOrder.id,
        priority: workOrder.priority,
        issueType: workOrder.issueType,
        address: workOrder.address,
        accessNotes: workOrder.accessNotes,
        appUrl: `https://pabandi.com/coordinator/work-orders/${workOrder.id}`,
      });
    }

    res.json({
      success: true,
      data: {
        workOrder: updatedWorkOrder,
        assignment,
        technician: { id: technician.id, name: technician.name },
        dispatchWhatsApp: whatsAppResult,
      },
    });
  } catch (err: any) {
    logger.error('[ServiceCoordinator] assign technician failed:', err.message);
    res.status(500).json({ success: false, error: 'Could not assign technician' });
  }
});

/**
 * POST /api/v1/coordinator/work-orders/:id/unassign
 * Remove the technician from a work order.
 *
 * This is the real revert behind the command bar's Undo. Dismissing a
 * confirmation strip in the UI is not an undo — the assignment stays on the
 * server and the technician stays notified. Undo has to call this.
 *
 * Idempotent: replaying the same key returns the same response instead of
 * removing a second assignment. Append-only audit: an UNASSIGN entry is
 * recorded, never an edit of the ASSIGN entry.
 */
router.post('/work-orders/:id/unassign', idempotency, requireCoordinatorRole(['OWNER', 'COORDINATOR']), async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.businessId!;
    const validation = unassignWorkOrderSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: validation.error.format() });
    }

    const workOrder = await prisma.workOrder.findFirst({
      where: { id: req.params.id, businessId },
      include: { assignments: { orderBy: { assignedAt: 'desc' } } },
    });

    if (!workOrder) return res.status(404).json({ success: false, error: 'Work order not found' });
    if (workOrder.assignments.length === 0) {
      return res.status(409).json({ success: false, error: 'This work order has no technician to remove' });
    }

    // An explicit technicianId is honoured; otherwise the most recent assignment
    // is the one being undone. Either way we never guess silently.
    const target = validation.data.technicianId
      ? workOrder.assignments.find((assignment) => assignment.technicianId === validation.data.technicianId)
      : workOrder.assignments[0];

    if (!target) {
      return res.status(404).json({ success: false, error: 'That technician is not assigned to this work order' });
    }

    await prisma.workOrderAssignment.delete({ where: { id: target.id } });

    // Only fall back to unassigned when nobody is left on the job.
    const remaining = await prisma.workOrderAssignment.count({ where: { workOrderId: workOrder.id } });
    const updatedWorkOrder = await prisma.workOrder.update({
      where: { id: workOrder.id },
      data: remaining === 0 ? { status: 'PENDING_ASSIGNMENT' } : {},
    });

    const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`;
    await recordWorkOrderAudit({
      workOrderId: workOrder.id,
      actorId: req.user!.id,
      action: 'TECHNICIAN_UNASSIGNED',
      before: { technicianId: target.technicianId, assignmentId: target.id },
      after: { status: updatedWorkOrder.status, remainingAssignments: remaining },
      requestId,
    });

    res.json({
      success: true,
      data: {
        workOrder: updatedWorkOrder,
        removedAssignmentId: target.id,
        remainingAssignments: remaining,
      },
    });
  } catch (err: any) {
    logger.error('[ServiceCoordinator] unassign technician failed:', err.message);
    res.status(500).json({ success: false, error: 'Could not remove the technician from this work order' });
  }
});

/**
 * POST /api/v1/coordinator/work-orders/:id/triage-ai
 * AI-assisted commercial roofing dispatch and triage assistant.
 * Rate limited to max 20 dispatches per coordinator per hour.
 */
router.post('/work-orders/:id/triage-ai', aiTriageRateLimit, requireCoordinatorRole(['OWNER', 'COORDINATOR']), async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.businessId!;
    const validation = aiTriageSchema.safeParse(req.body || {});

    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Invalid triage parameters', details: validation.error.format() });
    }

    const [workOrder, technicians] = await Promise.all([
      prisma.workOrder.findFirst({ where: { id: req.params.id, businessId } }),
      prisma.technician.findMany({ where: { businessId, active: true } }),
    ]);

    if (!workOrder) return res.status(404).json({ success: false, error: 'Work order not found' });

    const triage = await generateDispatchTriage({
      description: workOrder.description,
      issueType: workOrder.issueType,
      address: workOrder.address,
      buildingType: validation.data.commercialBuildingType,
      roofSystem: validation.data.roofSystem,
      technicians,
    });

    const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`;
    await recordWorkOrderAudit({
      workOrderId: workOrder.id,
      actorId: req.user!.id,
      action: 'AI_TRIAGE_RUN',
      after: {
        triagePriority: triage.triagePriority,
        recommendedTech: triage.recommendedTechnicianName,
        confidence: triage.confidenceScore,
      },
      requestId,
    });

    res.json({ success: true, data: triage });
  } catch (err: any) {
    logger.error('[ServiceCoordinator] AI triage failed:', err.message);
    res.status(500).json({ success: false, error: 'AI Triage processing failed' });
  }
});

/**
 * POST /api/v1/coordinator/work-orders/:id/attachments
 * Upload photo / report / signature URL.
 */
router.post('/work-orders/:id/attachments', idempotency, requireCoordinatorRole(['OWNER', 'COORDINATOR', 'TECHNICIAN']), async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.businessId!;
    const validation = createAttachmentSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: validation.error.format() });
    }

    const workOrder = await prisma.workOrder.findFirst({
      where: { id: req.params.id, businessId },
    });
    if (!workOrder) return res.status(404).json({ success: false, error: 'Work order not found' });

    const attachment = await prisma.workOrderAttachment.create({
      data: {
        workOrderId: workOrder.id,
        kind: validation.data.kind,
        url: validation.data.url,
        uploadedById: req.user!.id,
      },
    });

    const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`;
    await recordWorkOrderAudit({
      workOrderId: workOrder.id,
      actorId: req.user!.id,
      action: 'ATTACHMENT_ADDED',
      after: { attachmentId: attachment.id, kind: attachment.kind },
      requestId,
    });

    res.status(201).json({ success: true, data: attachment });
  } catch (err: any) {
    logger.error('[ServiceCoordinator] add attachment failed:', err.message);
    res.status(500).json({ success: false, error: 'Could not add attachment' });
  }
});

/**
 * POST /api/v1/coordinator/work-orders/:id/complete
 * Submit completion report, mark COMPLETED, and transition invoiceStatus to READY with Raast escrow readiness.
 */
router.post('/work-orders/:id/complete', idempotency, requireCoordinatorRole(['OWNER', 'COORDINATOR', 'TECHNICIAN']), async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.businessId!;
    const validation = completeWorkOrderSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: validation.error.format() });
    }

    const { completionNotes, photoUrls, readyForInvoice } = validation.data;

    const workOrder = await prisma.workOrder.findFirst({
      where: { id: req.params.id, businessId },
      include: { customer: true },
    });
    if (!workOrder) return res.status(404).json({ success: false, error: 'Work order not found' });

    // Update work order status
    const updated = await prisma.workOrder.update({
      where: { id: workOrder.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        invoiceStatus: readyForInvoice ? 'READY' : workOrder.invoiceStatus,
      },
      include: {
        customer: true,
        assignments: { include: { technician: true } },
      },
    });

    // Record photo attachments if provided
    if (Array.isArray(photoUrls) && photoUrls.length > 0) {
      for (const url of photoUrls) {
        await prisma.workOrderAttachment.create({
          data: {
            workOrderId: workOrder.id,
            kind: 'photo',
            url,
            uploadedById: req.user!.id,
          },
        });
      }
    }

    // Raast / UniversalEscrow integration: Generate commercial milestone escrow readiness
    const escrowRef = `wo_${workOrder.id.slice(-6)}_${Date.now()}`;
    const escrowProposalUrl = `https://pabandi.com/p/estimate/${escrowRef}`;

    const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`;
    await recordWorkOrderAudit({
      workOrderId: workOrder.id,
      actorId: req.user!.id,
      action: 'COMPLETED',
      after: {
        completedAt: updated.completedAt,
        completionNotes,
        invoiceStatus: updated.invoiceStatus,
        escrowRef,
      },
      requestId,
    });

    res.json({
      success: true,
      data: {
        workOrder: updated,
        completionNotes,
        escrow: {
          escrowRef,
          status: 'READY_FOR_SETTLEMENT',
          proposalUrl: escrowProposalUrl,
          rail: 'RAAST_OR_USDC',
        },
      },
    });
  } catch (err: any) {
    logger.error('[ServiceCoordinator] complete work order failed:', err.message);
    res.status(500).json({ success: false, error: 'Could not complete work order' });
  }
});

/**
 * GET /api/v1/coordinator/technicians
 * List technicians for the business.
 */
router.get('/technicians', requireCoordinatorRole(['OWNER', 'COORDINATOR']), async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.businessId!;
    const technicians = await prisma.technician.findMany({
      where: { businessId },
      include: {
        _count: {
          select: { assignments: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const sanitized = technicians.map((t) => ({
      ...t,
      phoneMasked: maskPhone(decryptPii(t.phoneEncrypted)),
      phoneEncrypted: undefined, // Never expose raw encrypted blob
    }));

    res.json({ success: true, data: sanitized });
  } catch (err: any) {
    logger.error('[ServiceCoordinator] list technicians failed:', err.message);
    res.status(500).json({ success: false, error: 'Could not fetch technicians' });
  }
});

/**
 * POST /api/v1/coordinator/technicians
 * Register new technician with encrypted phone and certified skills.
 */
router.post('/technicians', idempotency, requireCoordinatorRole(['OWNER', 'COORDINATOR']), async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.businessId!;
    const validation = createTechnicianSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: validation.error.format() });
    }

    const { name, phone, skills, active } = validation.data;

    const technician = await prisma.technician.create({
      data: {
        businessId,
        name,
        phoneEncrypted: encryptPii(phone),
        skills,
        active,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        ...technician,
        phoneMasked: maskPhone(phone),
        phoneEncrypted: undefined,
      },
    });
  } catch (err: any) {
    logger.error('[ServiceCoordinator] create technician failed:', err.message);
    res.status(500).json({ success: false, error: 'Could not create technician' });
  }
});

/**
 * GET /api/v1/coordinator/customers
 * List customers for the business.
 */
router.get('/customers', requireCoordinatorRole(['OWNER', 'COORDINATOR']), async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.businessId!;
    const customers = await prisma.customer.findMany({
      where: { businessId },
      include: {
        _count: { select: { workOrders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const sanitized = customers.map((c) => ({
      ...c,
      phoneMasked: c.phoneEncrypted ? maskPhone(decryptPii(c.phoneEncrypted)) : null,
      phoneEncrypted: undefined,
    }));

    res.json({ success: true, data: sanitized });
  } catch (err: any) {
    logger.error('[ServiceCoordinator] list customers failed:', err.message);
    res.status(500).json({ success: false, error: 'Could not fetch customers' });
  }
});

/**
 * POST /api/v1/coordinator/customers
 * Register customer with encrypted phone at rest.
 */
router.post('/customers', idempotency, requireCoordinatorRole(['OWNER', 'COORDINATOR']), async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.businessId!;
    const validation = createCustomerSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: validation.error.format() });
    }

    const { name, email, phone, address, notes } = validation.data;

    const customer = await prisma.customer.create({
      data: {
        businessId,
        name,
        email: email || null,
        phoneEncrypted: phone ? encryptPii(phone) : null,
        address: address || null,
        notes: notes || null,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        ...customer,
        phoneMasked: phone ? maskPhone(phone) : null,
        phoneEncrypted: undefined,
      },
    });
  } catch (err: any) {
    logger.error('[ServiceCoordinator] create customer failed:', err.message);
    res.status(500).json({ success: false, error: 'Could not create customer' });
  }
});

// ── Predictive engine (§7) ────────────────────────────────────────────────

/**
 * POST /api/v1/coordinator/work-orders/:id/predict
 * Point risk prediction for one work order.
 *
 * The body is empty; the work order is identified by the path and scoped by
 * the session's businessId, never by anything the client sends.
 */
router.post(
  '/work-orders/:id/predict',
  requireCoordinatorRole(['OWNER', 'COORDINATOR', 'TECHNICIAN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const businessId = req.user!.businessId!;
      const prediction = await predictWorkOrderRisk(req.params.id, businessId);

      if (!prediction) {
        return res.status(404).json({ success: false, error: 'Work order not found' });
      }

      res.json({ success: true, data: prediction });
    } catch (err: any) {
      logger.error('[ServiceCoordinator] risk prediction failed:', err.message);
      res.status(500).json({ success: false, error: 'Could not score this work order' });
    }
  },
);

/**
 * POST /api/v1/coordinator/work-orders/:id/simulate
 * Counterfactual range for the what-if strip (§7.2).
 *
 * Returns p10/p50/p90 rather than a point estimate, plus `outOfRange` when a
 * slider pushed a feature more than two standard deviations from the training
 * mean — the UI greys the result rather than presenting it as a prediction.
 */
router.post(
  '/work-orders/:id/simulate',
  predictiveRateLimit,
  requireCoordinatorRole(['OWNER', 'COORDINATOR']),
  async (req: AuthRequest, res: Response) => {
    try {
      const parsed = simulateRiskSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'That what-if change could not be read. Check the values and try again.',
          details: parsed.error.issues.map((issue) => issue.message),
        });
      }

      const businessId = req.user!.businessId!;
      const simulation = await simulateWorkOrderRisk(req.params.id, businessId, parsed.data);

      if (!simulation) {
        return res.status(404).json({ success: false, error: 'Work order not found' });
      }

      res.json({ success: true, data: simulation });
    } catch (err: any) {
      logger.error('[ServiceCoordinator] risk simulation failed:', err.message);
      res.status(500).json({ success: false, error: 'Could not run that what-if scenario' });
    }
  },
);

export default router;

