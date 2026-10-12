import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import { CustomError } from '../middleware/errorHandler';

/**
 * Tenant scoping for the property surface.
 *
 * WHY THIS EXISTS
 * Every read and write on /api/v1/crm-advanced was unscoped. `getOverdueRent`
 * returned every landlord's unpaid rent, `getExpiringLeases` every landlord's
 * leases, and the financial and cashflow endpoints would generate a statement
 * for any property id the caller typed. They authenticated the caller but never
 * asked which landlord they were, so any signed-in account could read the whole
 * platform's property books. Four more endpoints — monthly rent generation, late
 * fees, lease-expiration sweeps and the automation runner — are worse than reads:
 * they iterate every schedule platform-wide and WRITE, so one user could trigger
 * financial mutations against every other landlord's tenants. Those are batch
 * jobs and belong behind an admin check, not a user token.
 *
 * (No rows are exposed today — the property tables are empty — but these are
 * write endpoints aimed at money, and they would have leaked the moment a
 * landlord added a property.)
 *
 * WHICH ID IS THE TENANT KEY
 * The schema declares `managerId` on PropertyTenant, PropertyLease,
 * PropertyMaintenance and TenantApplication as a foreign key to `AbodeManager`,
 * but nothing in the codebase ever creates an AbodeManager row. Every writer
 * stores `profile.id` from a `PropertyManagerProperty` lookup
 * (propertyManager.routes.ts), so in practice `managerId` holds a
 * PropertyManagerProperty id. Scoping on anything else would silently match zero
 * rows and read as "this landlord has no tenants" rather than as an error.
 *
 * `RentPayment` has no managerId at all; it reaches its landlord through
 * `propertyId`, which points at the same PropertyManagerProperty row. So the
 * two are scoped differently, and `assertPropertyOwned` exists for exactly that
 * reason rather than to paper over a missing predicate.
 */

/** The caller's landlord profile, or a CustomError explaining why there isn't one. */
export async function requirePropertyScope(req: AuthRequest): Promise<{ profileId: string }> {
  const userId = req.user?.id;
  if (!userId) throw new CustomError('Unauthorized', 401);

  const profile = await prisma.propertyManagerProperty.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) throw new CustomError('Not enrolled as a property manager', 403);

  return { profileId: profile.id };
}

/**
 * Property ids this landlord owns.
 *
 * The `PropertyManagerProperty` row that carries `userId` is the manager record,
 * not a building: enrollment creates it with `managerId` set to the caller's own
 * user id, while every real property is created with `managerId: profile.id`
 * (propertyManager.routes.ts). So ownership is exactly the set of rows whose
 * managerId is this profile — and the profile's own id is deliberately NOT in it,
 * or every landlord would appear to own a property they do not have.
 */
export async function ownedPropertyIds(profileId: string): Promise<string[]> {
  const rows = await prisma.propertyManagerProperty.findMany({
    where: { managerId: profileId },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** True when this landlord may act on `propertyId`. */
export async function isPropertyOwned(profileId: string, propertyId: string): Promise<boolean> {
  const owned = await ownedPropertyIds(profileId);
  return owned.includes(propertyId);
}

/**
 * A landlord's own tenant row, for the tenant-scoped endpoints.
 *
 * Tenant risk and the tenant ledger both take a tenantId. Returning the caller's
 * tenant rather than merely checking they own it means the handler cannot
 * accidentally read someone else's row: a miss is a 404, not an empty result
 * that looks like "no activity on this tenant".
 */
export async function requireOwnedTenant(req: AuthRequest, tenantId: string) {
  const { profileId } = await requirePropertyScope(req);
  const tenant = await prisma.propertyTenant.findFirst({
    where: { id: tenantId, managerId: profileId },
  });
  if (!tenant) throw new CustomError('Tenant not found', 404);
  return tenant;
}

/**
 * Batch jobs that mutate every landlord's data at once.
 *
 * Deliberately not merely authenticated. `generateMonthlyRent`, `applyLateFees`,
 * `checkLeaseExpirations` and the automation runner all iterate every schedule on
 * the platform; exposing them to any signed-in user lets one account write
 * financial records belonging to everyone else. ADMIN only.
 */
export function requireAdmin(req: AuthRequest): void {
  const role = req.user?.role;
  if (role !== 'ADMIN') {
    throw new CustomError('This action is restricted to administrators', 403);
  }
}