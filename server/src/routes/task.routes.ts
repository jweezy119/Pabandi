import { Router, Response } from 'express';
import { prisma } from '../utils/database';
import { trustCore } from '../trust/trust-core';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { CustomError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

/**
 * CRM tasks.
 *
 * WHAT WAS BROKEN HERE
 * This router had no authentication at all. `router.get('/')`, `router.post('/')`
 * and `router.patch('/:id')` were all mounted with no `authenticate`, and the
 * tenant came straight from `?businessId=` or the request body. So:
 *
 *   GET  /api/v1/crm/tasks?businessId=<any>   read another tenant's tasks
 *   POST /api/v1/crm/tasks                     create rows in any tenant
 *   PATCH /api/v1/crm/tasks/<id>               rewrite any task, unauthenticated
 *
 * The PATCH is the worst of them: it updated by id alone, so it needed no
 * businessId at all, and completing a task fires a trust event.
 *
 * It also built its own PrismaClient rather than using the shared one.
 *
 * Note: crm.routes.ts also declares /activities and /tasks, and is mounted at
 * /api/v1/crm BEFORE this router at /api/v1/crm/tasks. Express matches in
 * mount order, so crm.routes.ts wins and this file is currently shadowed for
 * the paths they share. Authentication is added regardless, so the moment the
 * mount order changes these endpoints are not instantly public.
 */

const router = Router();
router.use(authenticate);

/** The tenant this request may act on. Taken from the token, never the body. */
function requireBusinessId(req: AuthRequest): string {
  const businessId = req.user?.businessId ?? req.user?.activeBusinessId;
  if (!businessId) {
    throw new CustomError('No business is associated with this account', 403);
  }
  return businessId;
}

// List Tasks
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = requireBusinessId(req);
    const { clientId, dealId } = req.query;

    const tasks = await prisma.crmActivity.findMany({
      where: {
        businessId,
        type: 'TASK',
        ...(clientId ? { clientId: String(clientId) } : {}),
        ...(dealId ? { dealId: String(dealId) } : {}),
      },
      orderBy: { dueDate: 'asc' },
      include: {
        client: { select: { name: true, passportId: true } },
        deal: { select: { title: true } },
      },
    });

    res.json(tasks);
  } catch (err) {
    const status = err instanceof CustomError ? err.statusCode : 500;
    if (status === 500) {
      logger.error(`[Tasks] list failed: ${err instanceof Error ? err.message : err}`);
    }
    res.status(status).json({ error: err instanceof Error ? err.message : 'Failed to list tasks' });
  }
});

// Create Task
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = requireBusinessId(req);
    const { clientId, dealId, title, description, dueDate, priority, authorName } = req.body ?? {};

    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'title is required' });
    }

    const task = await prisma.crmActivity.create({
      data: {
        businessId,
        ...(clientId ? { clientId } : {}),
        ...(dealId ? { dealId } : {}),
        type: 'TASK',
        title: title.trim(),
        description: description ?? null,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority: typeof priority === 'string' ? priority : 'MEDIUM',
        status: 'TODO',
        ...(authorName ? { authorName } : {}),
      },
    });

    res.status(201).json(task);
  } catch (err) {
    const status = err instanceof CustomError ? err.statusCode : 500;
    if (status === 500) {
      logger.error(`[Tasks] create failed: ${err instanceof Error ? err.message : err}`);
    }
    res.status(status).json({ error: err instanceof Error ? err.message : 'Failed to create task' });
  }
});

// Update Task
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = requireBusinessId(req);
    const { id } = req.params;
    const { status, priority, title, description, dueDate } = req.body ?? {};

    // Scoped, and used as the concurrency guard: a task that has already been
    // closed by someone else is not silently re-opened or re-closed.
    const claimed = await prisma.crmActivity.updateMany({
      where: { id, businessId, type: 'TASK' },
      data: {
        ...(status ? { status } : {}),
        ...(priority ? { priority } : {}),
        ...(title ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
        ...(status ? { completed: status === 'DONE' } : {}),
      },
    });

    if (claimed.count === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = await prisma.crmActivity.findUnique({
      where: { id },
      include: { client: true },
    });

    if (status === 'DONE' && task?.clientId && task.client?.passportId) {
      await trustCore.emit('activity.task_completed', {
        taskId: id,
        clientId: task.clientId,
        passportId: task.client.passportId,
        completedAt: new Date(),
      });
    }

    res.json(task);
  } catch (err) {
    logger.error(`[Tasks] update failed: ${err instanceof Error ? err.message : err}`);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

export default router;
