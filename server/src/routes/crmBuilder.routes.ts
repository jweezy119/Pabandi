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

async function createObjectForBusiness(businessId: string, input: any) {
  const name = String(input?.name || '').trim();
  if (!name) throw new CustomError('name is required', 400);
  const rawFields = Array.isArray(input?.fields) ? input.fields : [];
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
      pluralName: input?.pluralName ? String(input.pluralName) : null,
      icon: String(input?.icon || 'pentagon'),
      color: String(input?.color || '#C97B5A'),
      description: input?.description ? String(input.description) : null,
      position: Number(input?.position || 0),
      businessId,
      serviceBusinessId: businessId,
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
  await award(businessId, 50, ['first_object']);
  return object;
}

router.post('/objects', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const object = await createObjectForBusiness(crm.businessId!, req.body);
    res.status(201).json({ success: true, data: object });
  } catch (e) {
    next(e);
  }
});

router.get('/objects/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const object = await ownedObject(crm.businessId!, req.params.id);
    if (!object) throw new CustomError('Object not found', 404);
    ok(res, object);
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

const BUILTIN_TEMPLATES = [
  {
    id: 'builtin:property', name: 'Rental Property', description: 'Track addresses, rent and lease dates.', icon: '🏠', color: '#C97B5A',
    data: { name: 'Property', pluralName: 'Properties', icon: '🏠', color: '#C97B5A', fields: [
      { label: 'Address', type: 'text' }, { label: 'Monthly rent', type: 'currency' },
      { label: 'Lease ends', type: 'date' }, { label: 'Tenant', type: 'text' },
      { label: 'Status', type: 'select', options: ['Available', 'Occupied', 'Maintenance'] },
    ] },
  },
  {
    id: 'builtin:job', name: 'Field Job', description: 'Crew, site, value and completion.', icon: '🧰', color: '#D9A854',
    data: { name: 'Job Site', pluralName: 'Job Sites', icon: '🧰', color: '#D9A854', fields: [
      { label: 'Site address', type: 'text' }, { label: 'Job value', type: 'currency' },
      { label: 'Start date', type: 'date' }, { label: 'Crew lead', type: 'text' },
      { label: 'Status', type: 'select', options: ['New', 'In progress', 'Done'] },
    ] },
  },
  {
    id: 'builtin:product', name: 'Product Catalogue', description: 'SKU, price and stock.', icon: '📦', color: '#8A9A7B',
    data: { name: 'Product', pluralName: 'Products', icon: '📦', color: '#8A9A7B', fields: [
      { label: 'SKU', type: 'text' }, { label: 'Price', type: 'currency' },
      { label: 'In stock', type: 'number' }, { label: 'Available', type: 'boolean' },
    ] },
  },
];

/** Built-ins plus templates published by this or other businesses. */
router.get('/templates', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const shared = await prisma.crmBlueprintTemplate.findMany({
      where: { OR: [{ isPublic: true }, { businessId: crm.businessId }] },
      orderBy: [{ isPublic: 'desc' }, { usageCount: 'desc' }],
    });
    ok(res, [
      ...BUILTIN_TEMPLATES.map((t) => ({ ...t, isPublic: true, builtin: true, usageCount: 0 })),
      ...shared,
    ]);
  } catch (e) {
    next(e);
  }
});

/** Turn one of the owner's objects into a reusable template. */
router.post('/templates', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    const object = await ownedObject(crm.businessId!, String(req.body?.objectId || ''));
    if (!object) throw new CustomError('Object not found', 404);
    const template = await prisma.crmBlueprintTemplate.create({
      data: {
        businessId: crm.businessId,
        name: String(req.body?.name || object.pluralName || object.name),
        description: object.description,
        icon: object.icon,
        color: object.color,
        data: {
          name: object.name,
          pluralName: object.pluralName,
          icon: object.icon,
          color: object.color,
          fields: object.fields.map((f) => ({ label: f.label, name: f.name, type: f.type, options: f.options, required: f.required })),
        } as any,
        isPublic: Boolean(req.body?.isPublic),
      },
    });
    await award(crm.businessId!, 30, ['template_sharer']);
    res.status(201).json({ success: true, data: template });
  } catch (e) {
    next(e);
  }
});

/** One-tap install: copy a template's fields into a new object. */
router.post('/templates/:id/use', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const crm = requireCrmContext(req);
    let template: any = null;
    if (req.params.id.startsWith('builtin:')) {
      template = BUILTIN_TEMPLATES.find((t) => t.id === req.params.id);
    } else {
      template = await prisma.crmBlueprintTemplate.findFirst({
        where: {
          id: req.params.id,
          OR: [{ isPublic: true }, { businessId: crm.businessId }],
        },
      });
      if (template) {
        await prisma.crmBlueprintTemplate.update({ where: { id: template.id }, data: { usageCount: { increment: 1 } } });
      }
    }
    if (!template) throw new CustomError('Template not found', 404);
    const data = template.data as any;
    const object = await createObjectForBusiness(crm.businessId!, data);
    res.status(201).json({ success: true, data: object });
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
