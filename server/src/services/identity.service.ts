import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

export async function findOrCreateUser({
  provider,
  providerId,
  email,
  metadata,
}: {
  provider: string;
  providerId: string;
  email?: string;
  metadata?: any;
}) {
  // 1. Try exact auth method match
  const existingMethod = await prisma.userAuthMethod.findUnique({
    where: { provider_providerId: { provider, providerId } },
    include: { user: { include: { memberships: { where: { role: 'owner' } } } } },
  });
  if (existingMethod) {
    await prisma.userAuthMethod.update({
      where: { id: existingMethod.id },
      data: { lastUsedAt: new Date() },
    });
    return existingMethod.user;
  }

  // 2. Try email match — links new provider to existing user
  if (email) {
    const existingUser = await prisma.user.findUnique({ 
      where: { email },
      include: { memberships: { where: { role: 'owner' } } },
    });
    if (existingUser) {
      await prisma.userAuthMethod.create({
        data: { userId: existingUser.id, provider, providerId, metadata },
      });
      return existingUser;
    }
  }

  // 3. Create new user + first auth method
  const newUser = await prisma.user.create({
    data: {
      email: email ?? `${provider}_${providerId}@pabandi.local`,
    } as any,
  });
  await prisma.userAuthMethod.create({
    data: { userId: newUser.id, provider, providerId, metadata },
  });
  return newUser;
}

export function getActiveBusinessId(user: any): string | null {
  const ownerMemberships = (user.memberships || []).filter((m: any) => m.role === 'owner');
  if (ownerMemberships.length > 0) {
    return ownerMemberships[0].businessId;
  }
  return user.business?.id || null;
}
