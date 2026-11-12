import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import crypto from 'crypto';

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
      // GitHub boost: add +25 up to 800 cold-start max
      if (provider === 'github' && (existingUser.trustScore || 0) < 800) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            trustScore: Math.min(800, (existingUser.trustScore || 700) + 25),
            githubId: providerId,
          },
        });
      }
      return existingUser;
    }
  }

  // 3. Create new user + first auth method
  const displayName: string =
    (metadata?.name as string) ||
    (metadata?.displayName as string) ||
    (email ? email.split('@')[0] : `${provider}_${providerId}`);
  const [givenName, ...rest] = displayName.trim().split(/\s+/);

  const isGithub = provider === 'github';
  const initialTrustScore = isGithub ? 725.0 : 700.0;

  const newUser = await prisma.user.create({
    data: {
      email: email ?? `${provider}_${providerId}@pabandi.local`,
      passwordHash: crypto.randomBytes(32).toString('hex'),
      firstName: givenName || displayName || 'Member',
      lastName: rest.length ? rest.join(' ') : 'Member',
      trustScore: initialTrustScore,
      disputeRate: 0.0,
      ...(isGithub && { githubId: providerId }),
    },
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
