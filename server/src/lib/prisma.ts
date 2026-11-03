import { PrismaClient } from '@prisma/client';
import { createTenantClient } from './prisma-tenant';
import { tenantContext } from './tenant-context';

const prismaClient = new PrismaClient();

export function getPrismaClient(): PrismaClient {
  const businessId = tenantContext.getStore()?.businessId ?? '';
  return createTenantClient(prismaClient, () => businessId) as PrismaClient;
}

export const prisma = getPrismaClient();
export { tenantContext };
