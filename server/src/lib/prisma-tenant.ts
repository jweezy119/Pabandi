import { PrismaClient } from '@prisma/client';

const TENANT_MODELS = ['CrmClient', 'CrmDeal', 'CrmJob', 'Invoice', 'CrmActivity', 'CrmTask', 'CrmFile', 'TeamMember'];

export function createTenantClient(base: PrismaClient, getBusinessId: () => string) {
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_MODELS.includes(model)) return query(args);
          
          const readOps = ['findMany', 'findFirst', 'findUnique', 'count'];
          const writeOps = ['findUnique', 'update', 'updateMany', 'delete', 'deleteMany'];
          
          if (readOps.includes(operation) || writeOps.includes(operation)) {
            const businessId = getBusinessId();
            if (businessId) {
              // Use type assertion to handle Prisma's varying arg types
              const argsWithWhere = args as Record<string, unknown> & { where?: Record<string, unknown> };
              argsWithWhere.where = { ...(argsWithWhere.where || {}), businessId: getBusinessId() };
            }
          }
          return query(args);
        },
      },
    },
  });
}