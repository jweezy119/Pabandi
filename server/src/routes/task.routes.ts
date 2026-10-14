import { Router, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/database';
import { trustCore } from '../trust/trust-core';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { resolveCrmBusiness, requireCrmContext } from '../middleware/crmContext.middleware';
import { CustomError } from '../middleware/errorHandler';
import { TASK_STATUSES, TASK_PRIORITIES } from '../domain/crm';
import { crmScope } from '../services/crm.service';
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
 * Note: crm.routes.ts declares no /tasks path, and is mounted at /api/v1/crm
 * BEFORE this router at /api/v1/crm/tasks. Express matches in mount order, so
 * requests to /tasks fall through to this file.
 *
 * WHAT WAS BROKEN HERE, LATER
 * Tasks live in the same CrmActivity table as activities, so they carried the
 * same anchor bug: the tenant came from the token's platform `Business.id`,
 * `serviceBusinessId` was never written, and the activity report -- which scopes
 * on that column -- therefore never counted a single task. The Tasks page listed
 * them and the reports page said zero.
 */

const router = Router();
router.use(authenticate);
router.use(resolveCrmBusiness);

// List Tasks
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const crm = requireCrmContext(req);
    const { clientId, dealId, status, priority } = req.query;

    // status and priority are both stored, both parsed on write, and both were
    // unfilterable: the board showed every task regardless of which column it was in.
    // Validated against the same closed sets the create path enforces, so a filter can
    // never name a value the board does not render.
    const where: Prisma.CrmActivityWhereInput = {
      ...crmScope(crm.serviceBusinessId, crm.businessId),
      type: 'TASK',
      ...(clientId ? { clientId: String(clientId) } : {}),
      ...(dealId ? { dealId: String(dealId) } : {}),
    };
    if (status && (TASK_STATUSES as readonly string[]).includes(String(status))) {
      where.status = String(status);
    }
    if (priority && (TASK_PRIORITIES as readonly string[]).includes(String(priority))) {
      where.priority = String(priority);
    }

    const tasks = await prisma.crmActivity.findMany({
      where,
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
/**
 * Task status and priority are constrained in the schema comment and in the UI
 * dropdown, but nothing enforced them: `priority` was accepted as any string, so a
 * typo produced a row that matched no filter and disappeared from every board.
 *
 * Rejecting rather than coercing matches parseStage on the deal side — a 400 that
 * names the legal values is recoverable, and a task that silently became MEDIUM is
 * not something anyone would notice until it mattered.
 */
function parseEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
  fallback: T,
): T {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  throw new CustomError(`Invalid ${label}. Expected one of: ${allowed.join(', ')}`, 400);
}

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const crm = requireCrmContext(req);
    const { clientId, dealId, title, description, dueDate, priority, authorName } = req.body ?? {};

    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'title is required' });
    }

    const task = await prisma.crmActivity.create({
      data: {
        serviceBusinessId: crm.serviceBusinessId,
        businessId: crm.businessId ?? null,
        ...(clientId ? { clientId } : {}),
        ...(dealId ? { dealId } : {}),
        type: 'TASK',
        title: title.trim(),
        description: description ?? null,
        dueDate: dueDate ? new Date(dueDate) : null,
        // Validated now. `typeof priority === 'string' ? priority : 'MEDIUM'`
        // accepted "high", "HIGH ", "urgent" and stored all three as distinct
        // values, none of which the board renders.
        priority: parseEnum(priority, TASK_PRIORITIES, 'priority', 'MEDIUM'),
        status: parseEnum(req.body?.status, TASK_STATUSES, 'status', 'TODO'),
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
    const crm = requireCrmContext(req);
    const { id } = req.params;
    const { status, priority, title, description, dueDate } = req.body ?? {};

    // Scoped, and used as the concurrency guard: a task that has already been
    // closed by someone else is not silently re-opened or re-closed.
    const claimed = await prisma.crmActivity.updateMany({
      where: { id, ...crmScope(crm.serviceBusinessId, crm.businessId), type: 'TASK' },
      data: {
        // Validated on update too, not just create: the board's status dropdown is
        // a plain <select>, and a value outside the set would write a row that no
        // column renders — the task would simply vanish from the board.
        ...(status ? { status: parseEnum(status, TASK_STATUSES, 'status', 'TODO') } : {}),
        ...(priority ? { priority: parseEnum(priority, TASK_PRIORITIES, 'priority', 'MEDIUM') } : {}),
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
    // The tenant check above throws a 403, and a blanket 500 answered it as a server
    // fault. Same misreport as the capital endpoints: an account with no business on
    // its token was told the database was broken.
    if (err instanceof CustomError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Failed to update task' });
  }
});

/**
 * DELETE /api/v1/crm/tasks/:id
 *
 * There was no way to remove a task. The board offered a TODO/DONE toggle and the list
 * offered the same, so a task created by mistake, or one that turned out not to be
 * work at all, stayed on the board forever — the only way to stop seeing it was to
 * complete it, which is a different and untrue claim.
 *
 * Scoped through `crmScope`, so a task id from another tenant is a 404 rather than a
 * delete.
 *
 * Deliberately emits no trust event. `activity.task_completed` fires on the DONE
 * transition, which is a record of work done. Deleting a row is an erasure, and
 * scoring someone's reliability on something they removed would let a score be
 * improved by deleting the evidence behind it.
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const crm = requireCrmContext(req);
    const deleted = await prisma.crmActivity.deleteMany({
      where: { id: req.params.id, ...crmScope(crm.serviceBusinessId, crm.businessId), type: 'TASK' },
    });
    if (deleted.count === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ success: true });
  } catch (err) {
    const status = err instanceof CustomError ? err.statusCode : 500;
    if (status === 500) {
      logger.error(`[Tasks] delete failed: ${err instanceof Error ? err.message : err}`);
    }
    res.status(status).json({ error: err instanceof Error ? err.message : 'Failed to delete task' });
  }
});

export default router;
