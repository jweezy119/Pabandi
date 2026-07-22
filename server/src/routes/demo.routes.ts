import { Router, Response } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { isDemoMode } from '../utils/env';

const router = Router();

router.post('/seed', async (_req: any, res: Response) => {
  try {
    if (!isDemoMode()) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    const demo = await prisma.$transaction(async (tx) => {
      const buyer = await tx.user.upsert({
        where: { email: 'judge-buyer@pabandi.local' },
        update: {},
        create: {
          email: 'judge-buyer@pabandi.local',
          passwordHash: 'demo',
          firstName: 'Judge',
          lastName: 'Buyer',
          role: 'CUSTOMER',
          isEmailVerified: true,
          reliabilityScore: 780,
          trustScore: 82,
          commerceScore: 88,
        },
      });

      const merchant = await tx.user.upsert({
        where: { email: 'judge-merchant@pabandi.local' },
        update: {},
        create: {
          email: 'judge-merchant@pabandi.local',
          passwordHash: 'demo',
          firstName: 'Merchant',
          lastName: 'Owner',
          role: 'BUSINESS_OWNER',
          isEmailVerified: true,
          reliabilityScore: 890,
          trustScore: 94,
          commerceScore: 96,
        },
      });

      const business = await tx.business.upsert({
        where: { id: 'demo-business-judge-1' },
        update: {},
        create: {
          id: 'demo-business-judge-1',
          ownerId: merchant.id,
          name: 'Judge Demo Merchant',
          category: 'RESTAURANT',
          address: '123 Demo St, Karachi',
          city: 'Karachi',
          country: 'Pakistan',
          phone: '+920000000000',
          email: 'judge-merchant@pabandi.local',
          isVerified: true,
          isActive: true,
          isClaimed: true,
          trustScore: 94,
          reliabilityScore: 890,
          slug: 'judge-demo-merchant',
        },
      });

      const reservationHonored = await tx.reservation.upsert({
        where: { id: 'demo-reservation-honored' },
        update: {},
        create: {
          id: 'demo-reservation-honored',
          businessId: business.id,
          customerId: buyer.id,
          reservationTime: '19:00',
          status: 'COMPLETED',
          depositRequired: true,
          depositPaid: true,
          depositAmount: 15,
          customerName: `${buyer.firstName} ${buyer.lastName}`,
          customerPhone: '+920000000001',
          customerEmail: buyer.email,
          reservationDate: new Date(Date.now() + 86400000),
          numberOfGuests: 2,
        },
      });

      const reservationNoShow = await tx.reservation.upsert({
        where: { id: 'demo-reservation-no-show' },
        update: {},
        create: {
          id: 'demo-reservation-no-show',
          businessId: business.id,
          customerId: buyer.id,
          reservationTime: '20:00',
          status: 'NO_SHOW',
          depositRequired: true,
          depositPaid: true,
          depositAmount: 20,
          customerName: `${buyer.firstName} ${buyer.lastName}`,
          customerPhone: '+920000000002',
          customerEmail: buyer.email,
          reservationDate: new Date(Date.now() + 172800000),
          numberOfGuests: 2,
        },
      });

      const wallet = await tx.wallet.upsert({
        where: { userId: buyer.id },
        update: {},
        create: {
          userId: buyer.id,
          balance: 100,
          totalStaked: 0,
          lockedPab: 15,
          usdcBalance: 85,
          currency: 'PAB',
          airdropClaimed: false,
        },
      });

      const treasury = await tx.treasuryPosition.create({
        data: {
          bucket: 'TREASURY',
          amount: 2500,
          status: 'DEPLOYED',
          meta: { currency: 'USD', strategy: 'Price Defense', note: 'Demo treasury reserve' },
        },
      });

      const pop = await tx.popEvidencePackage.create({
        data: {
          reservationId: reservationHonored.id,
          buyerIntentAt: new Date(Date.now() - 86400000),
          merchantFulfillAt: new Date(Date.now() - 43200000),
          evidence: { userId: buyer.id, businessId: business.id, source: 'demo', note: 'Judge demo evidence' },
        },
      });

      return { buyer, merchant, business, reservationHonored, reservationNoShow, wallet, treasury, pop };
    });

    return res.json({
      success: true,
      data: {
        buyerId: demo.buyer.id,
        merchantId: demo.merchant.id,
        businessId: demo.business.id,
        honoredReservationId: demo.reservationHonored.id,
        noShowReservationId: demo.reservationNoShow.id,
        walletId: demo.wallet.id,
        treasuryPositionId: demo.treasury.id,
        popId: demo.pop.id,
      },
    });
  } catch (error: any) {
    logger.error('Demo seed error:', error);
    return res.status(500).json({ success: false, error: 'Failed to seed demo data' });
  }
});

export default router;
