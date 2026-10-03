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
      return existingUser;
    }
  }

  // 3. Create new user + first auth method
  //
  // `passwordHash` is REQUIRED by the schema, and this create omitted it. That made
  // step 3 throw PrismaClientValidationError for every genuinely new user, on any
  // database — so first-time GitHub sign-in, first-time Google sign-in, and the "Sign
  // up" form on /login all returned 500. Only users who already existed got through,
  // via step 2.
  //
  // Found by the first integration test of the customer flow (tests/
  // customer-flow.integration.test.ts), not by a unit test: every unit test of this
  // function mocked prisma, and a mocked prisma cannot tell you that a required column
  // is missing.
  //
  // The `as any` on the old create is what hid it. It silenced the one compile-time
  // check that would have caught a missing required field, in exchange for suppressing
  // complaints about fields this function legitimately does not set. Removed — the
  // create below now type-checks.
  //
  // These accounts are passwordless: the OAuth provider is the credential. So the hash
  // is 32 random bytes that nobody holds, which makes password login impossible while
  // satisfying the column. Same approach as agentSignup.routes.ts, and deliberately
  // NOT a bcrypt hash of a known string, which would be a real credential.
  //
  // firstName and lastName are required too. That only became visible once the `as any`
  // came off: the cast was suppressing a genuine compile error about two more missing
  // required fields, so this create has never once succeeded for a new user. Providers
  // are inconsistent about display names — GitHub sends `name`, Twitter sends
  // `displayName`, and either may be absent — so fall back through both and then to the
  // email local part, mirroring agentSignup.routes.ts.
  const displayName: string =
    (metadata?.name as string) ||
    (metadata?.displayName as string) ||
    (email ? email.split('@')[0] : `${provider}_${providerId}`);
  const [givenName, ...rest] = displayName.trim().split(/\s+/);

  const newUser = await prisma.user.create({
    data: {
      email: email ?? `${provider}_${providerId}@pabandi.local`,
      passwordHash: crypto.randomBytes(32).toString('hex'),
      firstName: givenName || displayName || 'Member',
      lastName: rest.length ? rest.join(' ') : 'Member',
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
