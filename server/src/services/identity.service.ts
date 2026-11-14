import { prisma } from '../utils/database';
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
  // 1. Try provider column match
  let existingUser = null;
  if (provider === 'github') {
    existingUser = await prisma.user.findFirst({ where: { githubId: providerId }, include: { business: true } });
  } else if (provider === 'telegram') {
    existingUser = await prisma.user.findFirst({ where: { telegramId: providerId }, include: { business: true } });
  } else if (provider === 'google') {
    existingUser = await prisma.user.findFirst({ where: { googleId: providerId }, include: { business: true } });
  }

  if (existingUser) return existingUser;

  // 2. Try email match
  if (email) {
    existingUser = await prisma.user.findUnique({
      where: { email },
      include: { business: true },
    });
    if (existingUser) {
      if (provider === 'github' || provider === 'telegram') {
        existingUser = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            ...(provider === 'github' && { githubId: providerId }),
            ...(provider === 'telegram' && { telegramId: providerId }),
          },
          include: { business: true },
        });
      }
      return existingUser;
    }
  }

  // 3. Create new user
  const displayName: string =
    (metadata?.name as string) ||
    (metadata?.displayName as string) ||
    (metadata?.first_name ? `${metadata.first_name}${metadata.last_name ? ' ' + metadata.last_name : ''}` : '') ||
    (email ? email.split('@')[0] : `${provider}_${providerId}`);
  const [givenName, ...rest] = displayName.trim().split(/\s+/);

  const isGithub = provider === 'github';
  const isTelegram = provider === 'telegram';

  const newUser = await prisma.user.create({
    data: {
      email: email ?? `${provider}_${providerId}@pabandi.local`,
      passwordHash: crypto.randomBytes(32).toString('hex'),
      firstName: givenName || displayName || 'Member',
      lastName: rest.length ? rest.join(' ') : 'Member',
      trustScore: 70.0,
      disputeRate: 0.0,
      profilePictureUrl: metadata?.photo_url || metadata?.avatarUrl || null,
      ...(isGithub && { githubId: providerId }),
      ...(isTelegram && {
        telegramId: providerId,
        ...(metadata?.username && { username: metadata.username.toLowerCase() }),
      }),
    },
    include: { business: true },
  });

  return newUser;
}

export function getActiveBusinessId(user: any): string | null {
  if (user?.business?.id) return user.business.id;
  if (user?.businessId) return user.businessId;
  return null;
}
