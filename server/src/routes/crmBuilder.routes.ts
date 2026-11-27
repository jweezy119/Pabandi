import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { resolveCrmBusiness, requireCrmContext } from '../middleware/crmContext.middleware';
import { CustomError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate, resolveCrmBusiness);

export const FIELD_TYPES = [
  'text', 'longText', 'number', 'currency', 'date', 'boolean',
  'select', 'multiSelect', 'email', 'phone', 'link',
] as const;

const objectScope = (businessId: string) => ({
  OR: [{ businessId }, { serviceBusinessId: businessId }],
});

async function ownedObject(businessId: string, id: string) {
  return prisma.crmObjectDefinition.findFirst({
    where: { id, ...objectScope(businessId) },
    include: { fields: { orderBy: { position: 'asc' } } },
  });
}

/** Objects with their fields and record counts — everything the builder UI needs. */
router.get('/objects', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const objects = await prisma.crmObjectDefinition.findMany({
      where: objectScope(crm.businessId!),
      include: {
        fields: { orderBy: { position: 'asc' } },
        _count: { select: { records: true } },
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    });
    ok(res, objects);
  } catch (e) {
    next(e);
  }
});

router.post('/objects', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const name = String(req.body?.name || '').trim();
    if (!name) throw new CustomError('name is required', 400);
    const rawFields = Array.isArray(req.body?.fields) ? req.body.fields : [];
    if (rawFields.length > 30) throw new CustomError('maximum 30 fields per object', 400);
    for (const field of rawFields) {
      if (!String(field?.label || '').trim()) throw new CustomError('every field needs a label', 400);
      if (!(FIELD_TYPES as readonly string[]).includes(String(field?.type || 'text'))) {
        throw new CustomError(`field type must be one of ${FIELD_TYPES.join(', ')}`, 400);
      }
    }

    const object = await prisma.crmObjectDefinition.create({
      data: {
        name,
        pluralName: req.body?.pluralName ? String(req.body.pluralName) : null,
        icon: String(req.body?.icon || 'pentagon'),
        color: String(req.body?.color || '#C97B5A'),
        description: req.body?.description ? String(req.body.description) : null,
        position: Number(req.body?.position || 0),
        businessId: crm.businessId,
        serviceBusinessId: crm.businessId,
        fields: {
          create: rawFields.map((field: any, index: number) => ({
            name: field.name ? String(field.name) : slug(String(field.label)),
            label: String(field.label),
            type: String(field.type || 'text'),
            options: Array.isArray(field.options) ? (field.options as any) : undefined,
            required: Boolean(field.required),
            position: index,
          })),
        },
      },
      include: { fields: { orderBy: { position: 'asc' } } },
    });
    await award(crm.businessId!, 50, ['first_object']);
    res.status(201).json({ success: true, data: object });
  } catch (e) {
    next(e);
  }
});

router.delete('/objects/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const object = await ownedObject(crm.businessId!, req.params.id);
    if (!object) throw new CustomError('Object not found', 404);
    await prisma.crmObjectDefinition.delete({ where: { id: object.id } });
    ok(res, { deleted: true });
  } catch (e) {
    next(e);
  }
});

router.post('/objects/:id/fields', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const object = await ownedObject(crm.businessId!, req.params.id);
    if (!object) throw new CustomError('Object not found', 404);
    const label = String(req.body?.label || '').trim();
    const type = String(req.body?.type || 'text');
    if (!label) throw new CustomError('label is required', 400);
    if (!(FIELD_TYPES as readonly string[]).includes(type)) throw new CustomError('invalid field type', 400);
    const field = await prisma.crmFieldDefinition.create({
      data: {
        objectId: object.id,
        name: req.body?.name ? String(req.body.name) : slug(label),
        label,
        type,
        options: Array.isArray(req.body?.options) ? (req.body.options as any) : undefined,
        required: Boolean(req.body?.required),
        position: object.fields.length,
      },
    });
    await award(crm.businessId!, 10, object.fields.length + 1 >= 5 ? ['field_collector'] : []);
    res.status(201).json({ success: true, data: field });
  } catch (e) {
    next(e);
  }
});

router.delete('/objects/:id/fields/:fieldId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const object = await ownedObject(crm.businessId!, req.params.id);
    if (!object) throw new CustomError('Object not found', 404);
    await prisma.crmFieldDefinition.deleteMany({ where: { id: req.params.fieldId, objectId: object.id } });
    ok(res, { deleted: true });
  } catch (e) {
    next(e);
  }
});

router.get('/objects/:id/records', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const object = await ownedObject(crm.businessId!, req.params.id);
    if (!object) throw new CustomError('Object not found', 404);
    const records = await prisma.crmCustomRecord.findMany({
      where: { objectId: object.id, ...objectScope(crm.businessId!) },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    ok(res, records);
  } catch (e) {
    next(e);
  }
});

function validateData(fields: Array<{ name: string; label: string; required: boolean }>, data: any) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new CustomError('data must be an object', 400);
  for (const field of fields) {
    if (field.required && (data[field.name] === undefined || data[field.name] === '' || data[field.name] === null)) {
      throw new CustomError(`${field.label} is required`, 400);
    }
  }
  const allowed = new Set(fields.map((f) => f.name));
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (allowed.has(key)) clean[key] = value as unknown;
  }
  return clean;
}

router.post('/objects/:id/records', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const object = await ownedObject(crm.businessId!, req.params.id);
    if (!object) throw new CustomError('Object not found', 404);
    const data = validateData(object.fields, req.body?.data);
    const record = await prisma.crmCustomRecord.create({
      data: {
        objectId: object.id,
        businessId: crm.businessId,
        serviceBusinessId: crm.businessId,
        data: data as any,
      },
    });
    await award(crm.businessId!, 25, ['first_record']);
    res.status(201).json({ success: true, data: record });
  } catch (e) {
    next(e);
  }
});

router.patch('/objects/:id/records/:recordId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const object = await ownedObject(crm.businessId!, req.params.id);
    if (!object) throw new CustomError('Object not found', 404);
    const existing = await prisma.crmCustomRecord.findFirst({
      where: { id: req.params.recordId, objectId: object.id, ...objectScope(crm.businessId!) },
      select: { id: true, data: true },
    });
    if (!existing) throw new CustomError('Record not found', 404);
    const merged = { ...((existing.data as any) || {}), ...(req.body?.data || {}) };
    const data = validateData(object.fields, merged);
    const record = await prisma.crmCustomRecord.update({ where: { id: existing.id }, data: { data: data as any } });
    ok(res, record);
  } catch (e) {
    next(e);
  }
});

router.delete('/objects/:id/records/:recordId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const object = await ownedObject(crm.businessId!, req.params.id);
    if (!object) throw new CustomError('Object not found', 404);
    await prisma.crmCustomRecord.deleteMany({
      where: { id: req.params.recordId, objectId: object.id, ...objectScope(crm.businessId!) },
    });
    ok(res, { deleted: true });
  } catch (e) {
    next(e);
  }
});

router.get('/progress', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    let progress = await prisma.crmBuilderProgress.findUnique({ where: { businessId: crm.businessId! } });
    if (!progress) {
      progress = await prisma.crmBuilderProgress.create({ data: { businessId: crm.businessId! } });
    }
    ok(res, progress);
  } catch (e) {
    next(e);
  }
});

async function award(businessId: string, points: number, badges: string[]) {
  const existing = await prisma.crmBuilderProgress.findUnique({ where: { businessId } });
  const current = Array.isArray(existing?.badges) ? (existing!.badges as string[]) : [];
  const merged = Array.from(new Set([...current, ...badges]));
  return prisma.crmBuilderProgress.upsert({
    where: { businessId },
    create: { businessId, xp: points, badges: merged.length ? (merged as any) : undefined },
    update: { xp: { increment: points }, badges: merged as any },
  });
}

function slug(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'field';
}

function ok(res: Response, data: unknown) {
  res.json({ success: true, data });
}

export default router;
