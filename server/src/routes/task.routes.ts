import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { trustCore } from '../trust/trust-core';

const router = Router();
const prisma = new PrismaClient();

// List Tasks
router.get('/', async (req, res) => {
  const { businessId, clientId, dealId } = req.query;
  try {
    const where: any = { businessId: String(businessId), type: 'TASK' };
    if (clientId) where.clientId = String(clientId);
    if (dealId) where.dealId = String(dealId);

    const tasks = await prisma.crmActivity.findMany({
      where,
      orderBy: { dueDate: 'asc' },
      include: {
        client: { select: { name: true, passportId: true } },
        deal: { select: { title: true } }
      }
    });
    res.json(tasks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Task
router.post('/', async (req, res) => {
  const { businessId, clientId, dealId, title, description, dueDate, priority, authorName } = req.body;
  try {
    const task = await prisma.crmActivity.create({
      data: {
        businessId,
        clientId,
        dealId,
        type: 'TASK',
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority: priority || 'MEDIUM',
        status: 'TODO',
        authorName
      }
    });
    res.json(task);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Task
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { status, priority, title, description, dueDate } = req.body;
  try {
    const task = await prisma.crmActivity.update({
      where: { id },
      data: {
        status,
        priority,
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        completed: status === 'DONE'
      },
      include: { client: true }
    });

    if (status === 'DONE' && task.clientId && task.client?.passportId) {
      // Task completed fires activity.task_completed
      await trustCore.emit('activity.task_completed', {
        taskId: id,
        clientId: task.clientId,
        passportId: task.client.passportId,
        completedAt: new Date()
      });
    }

    res.json(task);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
