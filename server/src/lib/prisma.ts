import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';
import { createTenantClient } from './prisma-tenant';

export const tenantContext = new AsyncLocalStorage<{ businessId: string }>();

const prismaClient = new PrismaClient();

export function getPrismaClient(): PrismaClient {
  const businessId = tenantContext.getStore()?.businessId ?? '';
  return createTenantClient(prismaClient, () => businessId) as PrismaClient;
}

export const prisma = getPrismaClient();