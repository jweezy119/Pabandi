import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

const DEV_SUPPORT_TOKEN = 'dev-support-token';

function readToken(req: Request): string | null {
  const header = req.header('x-admin-token');
  if (header) return header.trim();
  if (typeof req.query.token === 'string') return req.query.token.trim();
  return null;
}

function requireAdminToken(req: Request, res: Response): boolean {
  const expected = process.env.ADMIN_SUPPORT_TOKEN;
  const token = readToken(req);

  if (!expected) {
    if (process.env.NODE_ENV === 'production') {
      res.status(503).json({ success: false, error: 'ADMIN_SUPPORT_TOKEN is not configured' });
      return false;
    }
    if (token !== DEV_SUPPORT_TOKEN) {
      res.status(401).json({ success: false, error: 'Invalid admin token' });
      return false;
    }
    logger.warn('[AdminSupport] Using development admin token');
    return true;
  }

  if (!token) {
    res.status(401).json({ success: false, error: 'Missing x-admin-token' });
    return false;
  }

  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    res.status(401).json({ success: false, error: 'Invalid admin token' });
    return false;
  }
  return true;
}

const userSelect = {
  id: true,
  email: true,
  phone: true,
  firstName: true,
  lastName: true,
  role: true,
  activeMode: true,
  isEmailVerified: true,
  isPhoneVerified: true,
  createdAt: true,
} as const;

function publicUser(user: any) {
  return {
    ...user,
    email: user.email,
    phone: user.phone,
  };
}

router.get('/users', async (req: Request, res: Response) => {
  if (!requireAdminToken(req, res)) return;

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const role = typeof req.query.role === 'string' ? req.query.role.trim() : '';
  const take = Math.min(Number(req.query.limit) || 100, 500);

  const where: any = {};
  if (q) {
    where.OR = [
      { email: { contains: q, mode: 'insensitive' } },
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q } },
    ];
  }
  if (role) where.role = role;

  const users = await prisma.user.findMany({
    where,
    select: userSelect,
    orderBy: { createdAt: 'desc' },
    take,
  });

  const total = await prisma.user.count({ where });
  res.json({ success: true, data: { total, users: users.map(publicUser) } });
});

router.post('/users', async (req: Request, res: Response) => {
  if (!requireAdminToken(req, res)) return;

  const { email, password, firstName, lastName, phone, role, activeMode } = req.body || {};
  if (!email || !password || !firstName || !lastName) {
    res.status(400).json({ success: false, error: 'email, password, firstName, lastName are required' });
    return;
  }
  if (String(password).length < 8) {
    res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
  if (existing) {
    res.status(409).json({ success: false, error: 'A user with that email already exists' });
    return;
  }

  const user = await prisma.user.create({
    data: {
      email: String(email).toLowerCase(),
      passwordHash: await bcrypt.hash(String(password), 12),
      firstName: String(firstName),
      lastName: String(lastName),
      phone: phone ? String(phone) : null,
      role: role || 'CUSTOMER',
      activeMode: activeMode || 'CUSTOMER',
    },
    select: userSelect,
  });

  logger.info(`[AdminSupport] Created user ${user.email}`);
  res.status(201).json({ success: true, data: publicUser(user) });
});

router.patch('/users/:id', async (req: Request, res: Response) => {
  if (!requireAdminToken(req, res)) return;

  const { firstName, lastName, role, activeMode, phone } = req.body || {};
  const data: any = {};
  if (firstName !== undefined) data.firstName = String(firstName);
  if (lastName !== undefined) data.lastName = String(lastName);
  if (role !== undefined) data.role = String(role);
  if (activeMode !== undefined) data.activeMode = String(activeMode);
  if (phone !== undefined) data.phone = phone ? String(phone) : null;

  if (Object.keys(data).length === 0) {
    res.status(400).json({ success: false, error: 'No updatable fields supplied' });
    return;
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: userSelect,
    });
    logger.info(`[AdminSupport] Updated user ${user.email}`);
    res.json({ success: true, data: publicUser(user) });
  } catch {
    res.status(404).json({ success: false, error: 'User not found' });
  }
});

router.post('/users/:id/password', async (req: Request, res: Response) => {
  if (!requireAdminToken(req, res)) return;

  const password = req.body?.password;
  if (!password || String(password).length < 8) {
    res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    return;
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { passwordHash: await bcrypt.hash(String(password), 12) },
      select: { id: true, email: true },
    });
    logger.info(`[AdminSupport] Reset password for ${user.email}`);
    res.json({ success: true, data: { id: user.id, email: user.email } });
  } catch {
    res.status(404).json({ success: false, error: 'User not found' });
  }
});

router.delete('/users/:id', async (req: Request, res: Response) => {
  if (!requireAdminToken(req, res)) return;

  try {
    const user = await prisma.user.delete({
      where: { id: req.params.id },
      select: { id: true, email: true },
    });
    logger.info(`[AdminSupport] Deleted user ${user.email}`);
    res.json({ success: true, data: { id: user.id, email: user.email } });
  } catch (err: any) {
    if (err?.code === 'P2003' || err?.code === 'P2002') {
      res.status(409).json({
        success: false,
        error: 'User has related records. Remove their businesses, bookings, payments, or other owned records first.',
      });
      return;
    }
    res.status(404).json({ success: false, error: 'User not found' });
  }
});

export default router;
