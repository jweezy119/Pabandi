import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { resolveCrmBusiness, requireCrmContext } from '../middleware/crmContext.middleware';
import { CustomError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate, resolveCrmBusiness);

const scope = (businessId: string) => ({
  OR: [{ businessId }, { serviceBusinessId: businessId }],
});

async function ownedEmployee(businessId: string, id: string) {
  return prisma.crmEmployee.findFirst({
    where: { id, ...scope(businessId) },
    select: { id: true },
  });
}

/** Team directory. Backed by CrmEmployee — the app has no separate User-team model. */
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const businessId = crm.businessId!;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const search = String(req.query.search || '').trim();
    const role = String(req.query.role || '');
    const isActive = String(req.query.isActive || '');

    const where: any = { OR: [{ businessId }, { serviceBusinessId: businessId }] };
    if (search) {
      where.AND = [{ OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ] }];
    }
    if (role && role !== 'all') where.role = role;
    if (isActive === 'true') where.isActive = true;
    if (isActive === 'false') where.isActive = false;

    const [members, total] = await Promise.all([
      prisma.crmEmployee.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.crmEmployee.count({ where }),
    ]);

    res.json({
      success: true,
      data: members,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const member = await prisma.crmEmployee.findFirst({
      where: { id: req.params.id, ...scope(crm.businessId!) },
    });
    if (!member) throw new CustomError('Team member not found', 404);
    res.json(member);
  } catch (e) {
    next(e);
  }
});

router.post('/invite', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const { name, email, phone, role } = req.body ?? {};
    if (!name || !email) throw new CustomError('name and email are required', 400);
    const member = await prisma.crmEmployee.create({
      data: {
        name: String(name),
        email: String(email),
        phone: phone ? String(phone) : null,
        role: role ? String(role) : 'member',
        businessId: crm.businessId!,
        serviceBusinessId: crm.businessId!,
      },
    });
    res.status(201).json({ success: true, data: member });
  } catch (e) {
    next(e);
  }
});

router.patch('/:id/role', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const role = String(req.body?.role || '');
    if (!role) throw new CustomError('role is required', 400);
    const existing = await ownedEmployee(crm.businessId!, req.params.id);
    if (!existing) throw new CustomError('Team member not found', 404);
    const member = await prisma.crmEmployee.update({
      where: { id: existing.id },
      data: { role },
    });
    res.json({ success: true, data: member });
  } catch (e) {
    next(e);
  }
});

router.patch('/:id/deactivate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const existing = await ownedEmployee(crm.businessId!, req.params.id);
    if (!existing) throw new CustomError('Team member not found', 404);
    const member = await prisma.crmEmployee.update({
      where: { id: existing.id },
      data: { isActive: false },
    });
    res.json({ success: true, data: member });
  } catch (e) {
    next(e);
  }
});

export default router;
