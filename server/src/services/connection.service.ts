import { prisma } from '../utils/database';

export const connectionService = {
  async upsertConnection(
    userId: string,
    connectedUserId: string,
    businessId?: string,
    originContext?: string
  ) {
    if (userId === connectedUserId) return null;

    const connection = await prisma.connection.upsert({
      where: {
        userId_connectedUserId: {
          userId,
          connectedUserId,
        },
      },
      update: {
        originContext: originContext || undefined,
        businessId: businessId || undefined,
      },
      create: {
        userId,
        connectedUserId,
        businessId,
        originContext,
        trustScore: 50,
      },
    });

    return connection;
  }
};
