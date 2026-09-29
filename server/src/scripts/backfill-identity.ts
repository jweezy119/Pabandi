import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

async function backfill() {
  logger.info('[backfill] Starting identity backfill...');

  // Backfill UserAuthMethod from existing provider IDs on User
  const users = await prisma.user.findMany({
    where: { email: { not: '' } },
    select: { id: true, email: true, githubId: true, googleId: true, twitterId: true, linkedinId: true, walletAddress: true },
  });

  let authMethodCount = 0;
  for (const user of users) {
    const methods: Array<{ provider: string; providerId: string }> = [];
    if (user.email) methods.push({ provider: 'email', providerId: user.email });
    if (user.githubId) methods.push({ provider: 'github', providerId: user.githubId });
    if (user.googleId) methods.push({ provider: 'google', providerId: user.googleId });
    if (user.twitterId) methods.push({ provider: 'twitter', providerId: user.twitterId });
    if (user.linkedinId) methods.push({ provider: 'linkedin', providerId: user.linkedinId });
    if (user.walletAddress) methods.push({ provider: 'wallet', providerId: user.walletAddress });

    for (const m of methods) {
      try {
        await prisma.userAuthMethod.create({ data: { userId: user.id, provider: m.provider, providerId: m.providerId } });
        authMethodCount++;
      } catch (e) {
        // skip duplicates
      }
    }
  }

  logger.info(`[backfill] Created ${authMethodCount} UserAuthMethod records`);

  // Backfill BusinessMember from Business.ownerId
  const businesses = await prisma.business.findMany({
    where: { ownerId: { not: '' } },
    select: { id: true, ownerId: true },
  });

  let memberCount = 0;
  for (const biz of businesses) {
    if (!biz.ownerId || biz.ownerId === '') continue;
    try {
      await prisma.businessMember.create({
        data: { userId: biz.ownerId, businessId: biz.id, role: 'owner' },
      });
      memberCount++;
    } catch (e) {
      // skip duplicates
    }
  }

  logger.info(`[backfill] Created ${memberCount} BusinessMember records`);
  logger.info('[backfill] Done');
  process.exit(0);
}

backfill().catch(err => {
  logger.error('[backfill] Failed:', err);
  process.exit(1);
});
