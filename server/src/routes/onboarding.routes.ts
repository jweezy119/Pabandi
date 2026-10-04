import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.middleware';
import { resolveCrmBusiness, requireCrmContext } from '../middleware/crmContext.middleware';
import { prisma } from '../utils/database';
import { setAvailability, getAvailability, claimSlug } from '../services/crm.service';
import { CustomError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);
router.use(resolveCrmBusiness);

/**
 * Business onboarding.
 *
 * OnboardingWizard is routed at `/onboarding` and POSTs
 * `{ profile, services, availability, employees }` here. Two things were wrong before this
 * existed, and both are worth naming because only one of them is the missing route:
 *
 *   1. The wizard sent NO `Authorization` header. Even with the endpoint in place it would
 *      have 401'd. That is a client bug, fixed alongside.
 *   2. Its catch block only `console.error`d, so the user completed the wizard and nothing
 *      happened, with no indication why.
 *
 * `POST /api/v1/onboarding/complete`
 *
 * All-or-nothing, in one transaction. Onboarding is what every later screen depends on, and
 * a half-onboarded business — hours set, no employees — is worse than one that was refused
 * with a reason. Validation runs BEFORE the transaction so a rejected payload writes nothing.
 *
 * Tenant comes from the resolved CRM context, never the body: onboarding writes employees and
 * hours into a business, and a body-supplied tenant id would file them into someone else's.
 */
router.post('/complete', async (req: AuthRequest, res: Response) => {
  try {
    const crm = requireCrmContext(req);
    const { profile, services, availability, employees } = req.body ?? {};

    const businessName = typeof profile?.businessName === 'string' ? profile.businessName.trim() : '';
    const ownerName = typeof profile?.ownerName === 'string' ? profile.ownerName.trim() : '';
    if (!businessName) throw new CustomError('businessName is required', 400);
    if (!ownerName) throw new CustomError('ownerName is required', 400);

    // Employees are validated up front. CrmEmployee.employeeId-style uniqueness does not
    // exist here, so a duplicate name inside one payload would create two crew members that
    // look identical in every list and assignment dropdown.
    const crew = Array.isArray(employees) ? employees : [];
    if (crew.length > 100) throw new CustomError('Too many employees (limit 100)', 400);
    const seen = new Set<string>();
    const crewRows = crew.map((e: any, i: number) => {
      const name = typeof e?.name === 'string' ? e.name.trim() : '';
      if (!name) throw new CustomError(`employees[${i}].name is required`, 400);
      const key = name.toLowerCase();
      if (seen.has(key)) throw new CustomError(`Duplicate employee name "${name}"`, 400);
      seen.add(key);
      const payRate = Number(e?.payRate ?? 0);
      return {
        name,
        phone: typeof e?.phone === 'string' && e.phone ? e.phone : null,
        // Role is NOT NULL with no default. The wizard sends no role, so default it to the
        // pay type's natural label rather than rejecting a payload the user filled in
        // correctly per the UI.
        role: typeof e?.role === 'string' && e.role ? e.role.trim() : 'STAFF',
        payRate: Number.isFinite(payRate) && payRate >= 0 ? payRate : 0,
        payType: e?.payType === 'PER_JOB' ? 'PER_JOB' : 'HOURLY',
        serviceBusinessId: crm.serviceBusinessId,
      };
    });

    // Throws on bad times/days/slots before anything is written.
    const availabilityRows = await setAvailability(crm.serviceBusinessId, availability ?? {});

    // Services have no model to live in yet (see CrmServiceBusiness.serviceCatalog), so they
    // are stored as JSON rather than dropped: a table with nothing reading it would be a
    // second dead relation, and the wizard's input is not lost.
    const catalog = Array.isArray(services)
      ? services
          .filter((s: any) => s && typeof s.name === 'string' && s.name.trim())
          .map((s: any) => ({
            name: String(s.name).trim(),
            price: Number.isFinite(Number(s.price)) ? Number(s.price) : 0,
            duration: Number.isFinite(Number(s.duration)) ? Number(s.duration) : 60,
            description: typeof s.description === 'string' ? s.description : '',
          }))
      : [];

    await prisma.$transaction([
      prisma.crmServiceBusiness.update({
        where: { id: crm.serviceBusinessId },
        data: {
          serviceType: 'SERVICE',
          serviceCatalog: catalog,
        },
      }),
      // Replace rather than append: re-running onboarding on a business that already has crew
      // would otherwise double the roster every time the wizard is opened.
      prisma.crmEmployee.deleteMany({ where: { serviceBusinessId: crm.serviceBusinessId } }),
      ...crewRows.map((row) => prisma.crmEmployee.create({ data: row })),
    ]);

    const slug = await claimSlug(crm.serviceBusinessId, businessName);

    res.status(201).json({
      success: true,
      data: {
        slug,
        employees: crewRows.length,
        services: catalog.length,
        availability: availabilityRows.length,
      },
    });
  } catch (err: any) {
    const status = Number(err?.statusCode) || 500;
    res.status(status).json({
      success: false,
      error: status >= 500 ? 'Onboarding failed' : err?.message ?? 'Invalid request',
    });
  }
});

/**
 * GET /api/v1/onboarding/availability
 *
 * Reads the stored week back. Added so the wizard can be reopened without the payload living
 * only in localStorage, which is where it was before — a second device, or a cleared browser,
 * silently lost every answer the user had already given.
 */
router.get('/availability', async (req: AuthRequest, res: Response) => {
  try {
    const crm = requireCrmContext(req);
    res.json({ success: true, data: await getAvailability(crm.serviceBusinessId) });
  } catch (err: any) {
    const status = Number(err?.statusCode) || 500;
    res.status(status).json({
      success: false,
      error: status >= 500 ? 'Could not load availability' : err?.message ?? 'Invalid request',
    });
  }
});

export default router;
