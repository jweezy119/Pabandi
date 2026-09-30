import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { apiLimiter } from '../middleware/rateLimit.middleware';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'pabandi-fallback-secret-2026';
const VC_EXPIRY_HOURS = 24;

function publicScores(passport: any) {
  return {
    payment: passport.paymentScore ?? 500,
    showUp: passport.showUpScore ?? 500,
    delivery: passport.deliveryScore ?? 500,
    tenancy: passport.tenancyScore ?? 500,
    freight: passport.freightScore ?? 500,
  };
}

/**
 * GET /api/v1/trust/resolve/:identifier
 * identifier can be: email, wallet address, github username, phone
 * Returns the linked TrustPassport with public scores only
 */
router.get('/resolve/:identifier', apiLimiter, async (req: Request, res: Response) => {
  try {
    const identifier = req.params.identifier;
    if (!identifier) {
      return res.status(400).json({ success: false, error: 'identifier is required' });
    }

    let passport: any = null;

    if (identifier.includes('@')) {
      passport = await prisma.trustPassport.findFirst({
        where: { userId: (await prisma.user.findUnique({ where: { email: identifier } }))?.id },
      });
    } else if (identifier.startsWith('0x') || identifier.length >= 32) {
      passport = await prisma.trustPassport.findFirst({
        where: { OR: [{ walletAddress: identifier }, { userId: (await prisma.user.findFirst({ where: { walletAddress: identifier } }))?.id }] },
      });
    } else {
      passport = await prisma.trustPassport.findFirst({
        where: { OR: [{ handle: { equals: identifier } }, { providerRef: identifier }] },
      });
    }

    if (!passport || passport.visibility !== 'PUBLIC') {
      return res.status(404).json({ success: false, error: 'Passport not found or private' });
    }

    return res.json({
      success: true,
      data: {
        handle: passport.handle,
        displayName: passport.displayName,
        category: passport.category,
        walletAddress: passport.walletAddress,
        claimsCount: passport.claimsCount,
        scores: publicScores(passport),
        verifiedIdentity: passport.verifiedIdentity,
        fraudFlag: passport.fraudFlag,
        issuedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    logger.error(`[Trust] resolve error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/trust/credential/:passportId
 * Returns a signed JWT verifiable credential for the passport
 */
router.get('/credential/:passportId', apiLimiter, async (req: Request, res: Response) => {
  try {
    const passportId = req.params.passportId;
    if (!passportId) {
      return res.status(400).json({ success: false, error: 'passportId is required' });
    }

    const passport = await prisma.trustPassport.findUnique({ where: { id: passportId } });
    if (!passport || passport.visibility !== 'PUBLIC') {
      return res.status(404).json({ success: false, error: 'Passport not found or private' });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + VC_EXPIRY_HOURS * 60 * 60 * 1000);

    const payload = {
      iss: 'https://pabandi.com',
      sub: passport.id,
      handle: passport.handle,
      displayName: passport.displayName,
      scores: publicScores(passport),
      verifiedEvents: passport.claimsCount,
      verifiedIdentity: passport.verifiedIdentity,
      issuedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    const signedJwt = jwt.sign(payload, JWT_SECRET, { expiresIn: `${VC_EXPIRY_HOURS}h` });

    return res.json({
      success: true,
      data: {
        credential: signedJwt,
        publicKeyUrl: `${req.protocol}://${req.get('host')}/.well-known/pabandi-keys.json`,
      },
    });
  } catch (error: any) {
    logger.error(`[Trust] credential error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
