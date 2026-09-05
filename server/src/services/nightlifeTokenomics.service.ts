// ═══════════════════════════════════════════════════════════════════════════════
// NIGHTLIFE TOKENOMICS ENGINE
// ═══════════════════════════════════════════════════════════════════════════════
// $PAB flows through the entire nightlife ecosystem:
// - Guests EARN $PAB for attendance, reviews, referrals
// - Promoters STAKE $PAB for tier upgrades and trust
// - Venues PAY in $PAB for platform services
// - Bottle purchases can use $PAB with discounts
// ═══════════════════════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Token Distribution Rates ────────────────────────────────────────────────
const TOKEN_RATES = {
  // Guest rewards
  GUEST_ATTENDANCE_REWARD: 5,           // $PAB per verified entry
  GUEST_FIRST_REVIEW_REWARD: 10,        // $PAB for first review
  GUEST_REVIEW_REWARD: 2,               // $PAB per review after first
  GUEST_REFERRAL_REWARD: 3,             // $PAB per referred friend who attends
  GUEST_BOTTLE_PURCHASE_REBATE: 0.05,   // 5% of bottle price back in $PAB
  GUEST_COVER_CHARGE_REBATE: 0.02,      // 2% of cover charge back in $PAB
  GUEST_DEPOSIT_RETURN_BONUS: 1,        // $PAB bonus for no-show deposit return
  
  // Promoter rewards
  PROMOTER_PER_GUEST_COMMISSION: 1,     // $PAB per arrived guest
  PROMOTER_ELITE_BONUS: 25,             // $PAB bonus for elite tier
  PROMOTER_PREMIUM_BONUS: 50,           // $PAB bonus for premium tier
  
  // Venue rewards
  VENUE_PLATFORM_REBATE: 0.01,          // 1% of platform fees back in $PAB
  VENUE_HIGH_VOLUME_BONUS: 10,          // $PAB for high-volume venues
};

// ── Token Staking Tiers ─────────────────────────────────────────────────────
const STAKING_TIERS = {
  BRONZE: {
    minStake: 10,
    maxStake: 99,
    benefits: ['Basic analytics', 'Standard guest list placement', 'Email support'],
    commissionDiscount: 0,
    color: '🥉',
  },
  SILVER: {
    minStake: 100,
    maxStake: 499,
    benefits: ['Advanced analytics', 'Priority guest list placement', 'WhatsApp support', '2% commission discount'],
    commissionDiscount: 0.02,
    color: '🥈',
  },
  GOLD: {
    minStake: 500,
    maxStake: 1999,
    benefits: ['Premium analytics', 'Top guest list placement', 'Phone support', '5% commission discount', 'Bottle pre-booking'],
    commissionDiscount: 0.05,
    color: '🥇',
  },
  PLATINUM: {
    minStake: 2000,
    maxStake: 9999,
    benefits: ['VIP analytics', 'Guaranteed guest list placement', 'Dedicated account manager', '10% commission discount', 'Priority bottle service', 'Cross-venue access'],
    commissionDiscount: 0.10,
    color: '💎',
  },
  DIAMOND: {
    minStake: 10000,
    maxStake: null,
    benefits: ['White-glove analytics', 'Exclusive access', 'Revenue sharing', '15% commission discount', 'Unlimited bottle pre-booking', 'Global venue access', 'Custom integrations'],
    commissionDiscount: 0.15,
    color: '💠',
  },
};

export const nightlifeTokenomicsService = {
  // ═══════════════════════════════════════════════════════════════════════════
  // GUEST REWARDS — Earn $PAB for attending, reviewing, referring
  // ═══════════════════════════════════════════════════════════════════════════
  
  async rewardGuestAttendance(guestListId: string) {
    const guestList = await prisma.guestList.findUnique({
      where: { id: guestListId },
      include: { venue: true },
    });
    if (!guestList || guestList.status !== 'ARRIVED') return null;

    // Mark as rewarded
    await prisma.guestList.update({
      where: { id: guestListId },
      data: { rewarded: true },
    });

    // Create reward transaction
    await prisma.agentTransaction.create({
      data: {
        type: 'NIGHTLIFE_ATTENDANCE_REWARD',
        amount: TOKEN_RATES.GUEST_ATTENDANCE_REWARD,
        description: `Attended ${guestList.venue?.name}`,
        referenceType: 'GUEST_LIST',
        referenceId: guestListId,
      },
    });

    return {
      amount: TOKEN_RATES.GUEST_ATTENDANCE_REWARD,
      reason: 'Attendance verified',
      venue: guestList.venue?.name,
    };
  },

  async rewardGuestReview(userId: string, reviewId: string, isFirstReview: boolean) {
    const reward = isFirstReview ? TOKEN_RATES.GUEST_FIRST_REVIEW_REWARD : TOKEN_RATES.GUEST_REVIEW_REWARD;

    await prisma.agentTransaction.create({
      data: {
        agentId: userId,
        type: 'NIGHTLIFE_REVIEW_REWARD',
        amount: reward,
        description: isFirstReview ? 'First venue review' : 'Venue review',
        referenceType: 'REVIEW',
        referenceId: reviewId,
              },
    });

    return { amount: reward, reason: isFirstReview ? 'First review bonus' : 'Review reward' };
  },

  async rewardGuestReferral(referrerId: string, referredUserId: string) {
    await prisma.agentTransaction.create({
      data: {
        userId: referrerId,
        type: 'NIGHTLIFE_REFERRAL_REWARD',
        amount: TOKEN_RATES.GUEST_REFERRAL_REWARD,
        description: 'Referred friend attended event',
        referenceType: 'REFERRAL',
        referenceId: referredUserId,
              },
    });

    return { amount: TOKEN_RATES.GUEST_REFERRAL_REWARD, reason: 'Referral reward' };
  },

  async rewardBottlePurchase(userId: string, amount: number, bottleReservationId: string) {
    const rebate = Math.round(amount * TOKEN_RATES.GUEST_BOTTLE_PURCHASE_REBATE * 100) / 100;

    await prisma.agentTransaction.create({
      data: {
        agentId: userId,
        type: 'NIGHTLIFE_BOTTLE_REBATE',
        amount: rebate,
        description: `Bottle purchase rebate ($${amount})`,
        referenceType: 'BOTTLE_RESERVATION',
        referenceId: bottleReservationId,
              },
    });

    return { amount: rebate, reason: 'Bottle purchase rebate' };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PROMOTER STAKING — Stake $PAB for tier upgrades and trust
  // ═══════════════════════════════════════════════════════════════════════════
  
  async stakePromoterTier(userId: string, tier: string) {
    const tierConfig = STAKING_TIERS[tier as keyof typeof STAKING_TIERS];
    if (!tierConfig) return { error: 'Invalid tier' };

    const existingStake = await prisma.agentStake.findFirst({
      where: { agentId: userId, type: 'PROMOTER_TIER', txStatus: 'ACTIVE' },
    });

    if (existingStake) {
      // Upgrade: refund old stake, create new
      await prisma.agentStake.update({
        where: { id: existingStake.id },
        data: { txStatus: 'UNSTAKED', unstakedAt: new Date() },
      });
    }

    // Create new stake
    const stake = await prisma.agentStake.create({
      data: {
        agentId: userId,
        type: 'PROMOTER_TIER',
        tier,
        amount: tierConfig.minStake,
        benefits: tierConfig.benefits,
                stakedAt: new Date(),
      },
    });

    // Transfer $PAB from user wallet
    await prisma.agentTransaction.create({
      data: {
        agentId: userId,
        type: 'PROMOTER_TIER_STAKE',
        amount: -tierConfig.minStake,
        description: `Staked for ${tier} promoter tier`,
        referenceType: 'PROMOTER_STAKE',
        referenceId: stake.id,
              },
    });

    return { stake, tierConfig };
  },

  async unstakePromoterTier(userId: string) {
    const existingStake = await prisma.agentStake.findFirst({
      where: { agentId: userId, type: 'PROMOTER_TIER', txStatus: 'ACTIVE' },
    });

    if (!existingStake) return { error: 'No active stake found' };

    await prisma.agentStake.update({
      where: { id: existingStake.id },
      data: { txStatus: 'UNSTAKED', unstakedAt: new Date() },
    });

    // Refund $PAB to user wallet
    await prisma.agentTransaction.create({
      data: {
        agentId: userId,
        type: 'PROMOTER_TIER_UNSTAKE',
        amount: existingStake.amount,
        description: `Unstaked ${existingStake.tier} promoter tier`,
        referenceType: 'PROMOTER_STAKE',
        referenceId: existingStake.id,
              },
    });

    return { refunded: existingStake.amount, tier: existingStake.tier };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VENUE PAYMENTS — Pay platform fees in $PAB with discounts
  // ═══════════════════════════════════════════════════════════════════════════
  
  async payVenueSubscription(venueId: string, amountUsd: number) {
    // Convert USD to $PAB (simplified - in production use oracle)
    const pabRate = 1; // $1 = 1 $PAB for simplicity
    const amountPab = Math.round(amountUsd * pabRate * 100) / 100;

    // 10% discount for paying in $PAB
    const discount = 0.10;
    const finalPab = Math.round(amountPab * (1 - discount) * 100) / 100;

    await prisma.agentTransaction.create({
      data: {
        type: 'VENUE_SUBSCRIPTION',
        amount: -finalPab,
        description: `Venue subscription ($${amountUsd} → ${finalPab} $PAB, 10% discount)`,
        referenceType: 'VENUE',
        referenceId: venueId,
              },
    });

    return { amountUsd, amountPab: finalPab, discount: discount * 100 };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GUEST LIST DEPOSIT — Deposit $PAB to secure guest list spot
  // ═══════════════════════════════════════════════════════════════════════════
  
  async depositGuestListSpot(userId: string, guestListId: string, amountPab: number) {
    await prisma.agentTransaction.create({
      data: {
        agentId: userId,
        type: 'GUEST_LIST_DEPOSIT',
        amount: -amountPab,
        description: `Guest list deposit for ${guestListId}`,
        referenceType: 'GUEST_LIST',
        referenceId: guestListId,
        status: 'HELD', // Held until event, then returned or forfeited
      },
    });

    // If guest shows up, return deposit + bonus
    // If no-show, deposit goes to venue
    return { held: amountPab, status: 'HELD' };
  },

  async returnGuestListDeposit(userId: string, guestListId: string, showUp: boolean) {
    const deposit = await prisma.agentTransaction.findFirst({
      where: { agentId: userId, referenceId: guestListId, type: 'GUEST_LIST_DEPOSIT' },
    });

    if (!deposit) return null;

    if (showUp) {
      // Return deposit + bonus
      await prisma.agentTransaction.update({
        where: { id: deposit.id },
        data: { status: 'COMPLETED' },
      });

      const bonus = TOKEN_RATES.GUEST_DEPOSIT_RETURN_BONUS;
      await prisma.agentTransaction.create({
        data: {
          agentId: userId,
          type: 'GUEST_LIST_DEPOSIT_RETURN',
          amount: deposit.amount + bonus,
          description: 'Deposit returned + no-show prevention bonus',
          referenceType: 'GUEST_LIST',
          referenceId: guestListId,
                  },
      });

      return { returned: deposit.amount + bonus, bonus };
    } else {
      // Forfeit deposit to venue
      await prisma.agentTransaction.update({
        where: { id: deposit.id },
        data: { status: 'FORFEITED' },
      });

      return { forfeited: Math.abs(deposit.amount) };
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANALYTICS — Token flow and economy stats
  // ═══════════════════════════════════════════════════════════════════════════
  
  async getTokenomicsStats(period: 'day' | 'week' | 'month' = 'week') {
    const now = new Date();
    const periods = { day: 1, week: 7, month: 30 };
    const since = new Date(now.getTime() - periods[period] * 24 * 60 * 60 * 1000);

    const transactions = await prisma.agentTransaction.findMany({
      where: { createdAt: { gte: since }, status: 'COMPLETED' },
    });

    const stats = {
      totalDistributed: 0,
      totalCollected: 0,
      totalStaked: 0,
      byType: {} as Record<string, { count: number; amount: number }>,
    };

    for (const tx of transactions) {
      if (tx.amount > 0) stats.totalDistributed += tx.amount;
      else stats.totalCollected += Math.abs(tx.amount);

      if (tx.type.includes('STAKE')) stats.totalStaked += Math.abs(tx.amount);

      if (!stats.byType[tx.type]) stats.byType[tx.type] = { count: 0, amount: 0 };
      stats.byType[tx.type].count++;
      stats.byType[tx.type].amount += tx.amount;
    }

    return stats;
  },

  async getUserNightlifeBalance(userId: string) {
    const wallet = await prisma.pabWallet.findUnique({ where: { userId } });
    return {
      balance: wallet?.balance || 0,
      lifetimeEarned: wallet?.lifetimeEarned || 0,
      lifetimeSpent: wallet?.lifetimeSpent || 0,
    };
  },
};
