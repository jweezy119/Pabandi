import { PrismaClient } from '@prisma/client';

export type PassportCategory =
  | 'hospitality'
  | 'live_selling'
  | 'freelance'
  | 'gig'
  | 'general';

export interface PassportScoreComponents {
  base: number;
  disputePenalty: number;
  stakeBonus: number;
  socialBonus: number;
  channelBonus: number;
}

export interface PassportScoreResult {
  userId: string;
  category: PassportCategory;
  categoryScore: number;
  compositeScore: number;
  tier: string;
  penalty: number;
  stakeBonus: number;
  socialBonus: number;
  channelBonus: number;
  components: PassportScoreComponents;
}

export interface MyPassportResult {
  owner: string;
  trustScore: number;
  axes: PassportScoreResult[];
  tier: PassportScoreResult;
  activeStake: number;
  activeFlags: number;
  exportUrl: string;
}

export interface PublicPassportResult {
  owner: string;
  trustScore: number;
  tier: PassportScoreResult;
  activeFlags: number;
  axes: { category: PassportCategory; compositeScore: number; tier: string }[];
}

export interface VouchResult {
  targetUserId: string;
  newCompositeScore: number;
  tier: string;
  category: string;
}

export interface WhatsAppChannelSignalResult {
  userId: string;
  signalCategory: string;
  scoreDelta: number;
  newCompositeScore: number;
  tier: string;
}

export interface SocialGraphSignalResult {
  userId: string;
  signalCategory: string;
  scoreDelta: number;
  newCompositeScore: number;
  tier: string;
}

export interface Web3StakeRecordResult {
  userId: string;
  stakeAmount: number;
  stakeBonus: number;
  newCompositeScore: number;
  tier: string;
}

export interface PassportExportResult {
  exportedAt: string;
  passport: MyPassportResult;
  schemaVersion: string;
}

const prisma = new PrismaClient();

function normalizeTier(score: number): string {
  if (score >= 850) return 'PLATINUM';
  if (score >= 700) return 'GOLD';
  if (score >= 500) return 'SILVER';
  if (score >= 300) return 'BRONZE';
  return 'UNRATED';
}

export const computePassportScore = async (userId: string, category: PassportCategory = 'general'): Promise<PassportScoreResult> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, reliabilityScore: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const baseScore = Math.round(user.reliabilityScore || 0);
  const penalty = 0;
  const stakeBonus = 0;
  const socialBonus = 0;
  const channelBonus = 0;
  const composite = baseScore;

  const result: PassportScoreResult = {
    userId,
    category,
    categoryScore: composite,
    compositeScore: composite,
    tier: normalizeTier(composite),
    penalty,
    stakeBonus,
    socialBonus,
    channelBonus,
    components: { base: baseScore, disputePenalty: penalty, stakeBonus, socialBonus, channelBonus },
  };

  try {
    await prisma.passportScoreSnapshot.create({
      data: {
        userId,
        category,
        baseScore,
        compositeScore: composite,
        tier: result.tier,
        penalty,
        stakeBonus,
        socialBonus,
        channelBonus,
        meta: { category },
      },
    });
  } catch (error) {
    console.warn('Passport risk snapshot persistence failed', error);
  }

  return result;
};

export const getMyPassport = async (userId: string): Promise<MyPassportResult> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, reliabilityScore: true },
  });

  if (!user) throw new Error('User not found');

  const trustScore = Math.round(user.reliabilityScore || 0);
  const axes = await Promise.all(
    (['hospitality', 'live_selling', 'freelance', 'gig', 'general'] as PassportCategory[]).map((category) =>
      computePassportScore(userId, category),
    ),
  );

  const tier = axes[axes.length - 1];
  const flagsCount = await prisma.userFlag.count({
    where: { userId, isActive: true },
  });

  return {
    owner: userId,
    trustScore,
    axes,
    tier,
    activeStake: 0,
    activeFlags: flagsCount,
    exportUrl: `/api/v1/passport/export?userId=${encodeURIComponent(userId)}`,
  };
};

export const getPublicPassport = async (userId: string): Promise<PublicPassportResult> => {
  const my = await getMyPassport(userId);

  return {
    owner: my.owner,
    trustScore: my.trustScore,
    tier: my.tier,
    activeFlags: my.activeFlags,
    axes: my.axes.map((axis) => ({
      category: axis.category,
      compositeScore: axis.compositeScore,
      tier: axis.tier,
    })),
  };
};

export const vouchForUser = async (sourceUserId: string, targetUserId: string): Promise<VouchResult> => {
  const allCategories = ['general', 'hospitality', 'live_selling', 'freelance', 'gig'] as PassportCategory[];
  const axis = await computePassportScore(targetUserId, 'general');

  try {
    await prisma.socialGraphSignal.create({
      data: {
        userId: targetUserId,
        sourceUserId: sourceUserId,
        signalCategory: 'vouch',
        scoreDelta: 0,
        newCompositeScore: axis.compositeScore,
        tier: axis.tier,
        meta: { sourceUserId },
      },
    });
  } catch (error) {
    console.warn('Vouch signal persistence failed', error);
  }

  return {
    targetUserId,
    newCompositeScore: axis.compositeScore,
    tier: axis.tier,
    category: axis.category,
  };
};

export const recordWhatsAppChannelSignal = async (
  userId: string,
  payload: { signalCategory: string; scoreDelta?: number; meta?: unknown },
): Promise<WhatsAppChannelSignalResult> => {
  const axis = await computePassportScore(userId, 'general');
  const scoreDelta = Number(payload.scoreDelta || 0);
  const category = payload.signalCategory || 'general';

  try {
    await prisma.whatsAppChannelSignal.create({
      data: {
        userId,
        signalCategory: category,
        scoreDelta,
        newCompositeScore: axis.compositeScore,
        tier: axis.tier,
        meta: payload.meta || undefined,
      },
    });
  } catch (error) {
    console.warn('WhatsApp signal persistence failed', error);
  }

  return {
    userId,
    signalCategory: category,
    scoreDelta,
    newCompositeScore: axis.compositeScore,
    tier: axis.tier,
  };
};

export const recordSocialGraphSignal = async (
  userId: string,
  payload: { signalCategory: string; sourceUserId?: string; scoreDelta?: number; meta?: unknown },
): Promise<SocialGraphSignalResult> => {
  const axis = await computePassportScore(userId, 'general');
  const scoreDelta = Number(payload.scoreDelta || 0);
  const category = payload.signalCategory || 'social';

  try {
    await prisma.socialGraphSignal.create({
      data: {
        userId,
        sourceUserId: payload.sourceUserId || null,
        signalCategory: category,
        scoreDelta,
        newCompositeScore: axis.compositeScore,
        tier: axis.tier,
        meta: payload.meta || undefined,
      },
    });
  } catch (error) {
    console.warn('Social signal persistence failed', error);
  }

  return {
    userId,
    signalCategory: category,
    scoreDelta,
    newCompositeScore: axis.compositeScore,
    tier: axis.tier,
  };
};

export const recordWeb3Stake = async (
  userId: string,
  payload: { stakeAmount: number; meta?: unknown },
): Promise<Web3StakeRecordResult> => {
  const stakeAmount = Number(payload.stakeAmount || 0);
  const axis = await computePassportScore(userId, 'general');

  try {
    await prisma.web3StakeRecord.create({
      data: {
        userId,
        stakeAmount,
        stakeBonus: 0,
        newCompositeScore: axis.compositeScore,
        tier: axis.tier,
        txHash: typeof payload.meta === 'string' ? payload.meta : undefined,
      },
    });
  } catch (error) {
    console.warn('Web3 stake persistence failed', error);
  }

  return {
    userId,
    stakeAmount,
    stakeBonus: 0,
    newCompositeScore: axis.compositeScore,
    tier: axis.tier,
  };
};

export const exportPassport = async (userId: string): Promise<PassportExportResult> => {
  const passport = await getMyPassport(userId);

  return {
    exportedAt: new Date().toISOString(),
    passport,
    schemaVersion: '2026-07-20-passport-risk-v1',
  };
};
