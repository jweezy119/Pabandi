import { PrismaClient } from '@prisma/client';

const TENANT_MODELS = [
  'CrmClient',
  'CrmDeal',
  'CrmJob',
  'Invoice',
  'CrmActivity',
  'CrmTask',
  'CrmFile',
  'TeamMember',
];

// Non-negotiable: Strict tenant-isolation enforcement tables
const STRICT_TENANT_MODELS = [
  'WorkOrder',
  'Technician',
  'Customer',
  'Reservation',
];

export function createTenantClient(base: PrismaClient, getBusinessId: () => string) {
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model) return query(args);

          const isStrict = STRICT_TENANT_MODELS.includes(model);
          const isTenant = TENANT_MODELS.includes(model) || isStrict;
          if (!isTenant) return query(args);

          const sessionBusinessId = getBusinessId();
          const readOps = ['findMany', 'findFirst', 'findUnique', 'count', 'aggregate', 'groupBy'];
          const writeOps = ['update', 'updateMany', 'delete', 'deleteMany'];

          if (isStrict) {
            // Strict rejection check if query lacks businessId filter
            if (readOps.includes(operation) || writeOps.includes(operation)) {
              const argsWithWhere = (args || {}) as Record<string, unknown> & { where?: Record<string, unknown> };
              const effectiveBusinessId = sessionBusinessId || (argsWithWhere.where?.businessId as string | undefined);
              if (!effectiveBusinessId) {
                throw new Error(`Tenant isolation violation: Query on tenant-owned model ${model} missing businessId filter`);
              }
              argsWithWhere.where = { ...(argsWithWhere.where || {}), businessId: effectiveBusinessId };
            } else if (operation === 'create') {
              const argsWithData = (args || {}) as Record<string, unknown> & { data?: Record<string, unknown> };
              const effectiveBusinessId = sessionBusinessId || (argsWithData.data?.businessId as string | undefined);
              if (!effectiveBusinessId) {
                throw new Error(`Tenant isolation violation: Create on tenant-owned model ${model} missing businessId`);
              }
              if (argsWithData.data) {
                argsWithData.data.businessId = effectiveBusinessId;
              }
            }
            return query(args);
          }

          if (readOps.includes(operation) || writeOps.includes(operation)) {
            if (sessionBusinessId) {
              const argsWithWhere = args as Record<string, unknown> & { where?: Record<string, unknown> };
              argsWithWhere.where = { ...(argsWithWhere.where || {}), businessId: sessionBusinessId };
            }
          }
          return query(args);
        },
      },
    },
  });
}
