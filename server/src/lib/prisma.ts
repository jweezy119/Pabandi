import { createTenantClient } from './prisma-tenant';
import { tenantContext } from './tenant-context';
import { prisma as basePrisma } from '../utils/database';

export function getPrismaClient() {
  return createTenantClient(basePrisma, () => tenantContext.getStore()?.businessId ?? '') as typeof basePrisma;
}

export const prisma = getPrismaClient();
export { tenantContext };
