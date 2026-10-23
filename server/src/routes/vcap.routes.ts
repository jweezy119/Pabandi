import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { apiLimiter, writeLimiter } from '../middleware/rateLimit.middleware';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import crypto from 'crypto';

const router = Router();

/**
 * POST /api/v1/data-escrow/:id/verify
 * VCAP Verifier Oracle for data escrow verification
 */
const VCAPVerifySchema = z.object({
  deliveredDataHash: z.string().min(1, 'deliveredDataHash is required'),
  sourceUrl: z.string().optional(),
});

router.post('/data-escrow/:id/verify', authenticate, apiLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const escrowId = req.params.id;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const body = VCAPVerifySchema.parse(req.body);

    // Fetch the escrow record - looking for data escrow or any escrow that might be related to data
    const escrow = await prisma.universalEscrow.findUnique({
      where: { referenceId: escrowId },
      include: { parties: true, conditions: true, metadata: true },
    });

    if (!escrow) {
      return res.status(404).json({ success: false, error: 'Escrow not found' });
    }

    // Check if the user is a party to this escrow
    const isParty = escrow.parties?.some(party => party.partyId === userId);
    if (!isParty) {
      return res.status(403).json({ success: false, error: 'Unauthorized to verify this escrow' });
    }

    // Get expected data hash from metadata or escrow conditions
    const expectedDataHash = escrow.metadata?.dataHash || escrow.conditions?.find(c => c.type === 'delivery')?.verify?.expectedHash;

    if (!expectedDataHash) {
      return res.status(400).json({ success: false, error: 'No expected data hash found in escrow metadata or conditions' });
    }

    // Verify data hash
    const verificationResult = {
      expectedDataHash,
      deliveredDataHash: body.deliveredDataHash,
      hashMatches: expectedDataHash === body.deliveredDataHash,
      sourceUrl: body.sourceUrl,
      verifiedAt: new Date(),
      verifiedBy: userId,
    };

    if (!verificationResult.hashMatches) {
      // On Failure: Update escrow to 'refunded', return funds to buyer, create negative trust event for seller
      await prisma.universalEscrow.update({
        where: { referenceId: escrowId },
        data: { status: 'refunded' },
      });

      // Create a negative trust event for the seller
      await prisma.trustEvent.create({
        data: {
          type: 'data_verification_failed',
          passportId: escrow.parties?.find(p => p.role === 'seller')?.partyId || '',
          referenceId: escrowId,
          details: JSON.stringify({
            error: 'Data hash mismatch',
            expectedHash: expectedDataHash,
            deliveredHash: body.deliveredDataHash,
            timestamp: verificationResult.verifiedAt,
          }),
          createdAt: new Date(),
        },
      });

      logger.warn(`[VCAP] Verification failed for escrow ${escrowId}: hash mismatch`);
      return res.status(400).json({
        success: false,
        error: 'Data verification failed',
        details: 'The delivered data hash does not match the expected data hash',
        result: verificationResult,
      });
    }

    // On Success: Update escrow to 'verified', trigger release of funds via Pabandi Engine, create PAR record
    await prisma.universalEscrow.update({
      where: { referenceId: escrowId },
      data: { status: 'verified' },
    });

    // Trigger release of funds via Pabandi Engine
    // This would normally call the engine service, but for now we'll just log it
    logger.info(`[VCAP] Successfully verified data escrow ${escrowId}, funds will be released via Pabandi Engine`);

    // Create PAR (Provenance-Anchored Reputation) record
    const parId = crypto.randomBytes(16).toString('hex');
    await prisma.onchainAttestation.create({
      data: {
        passportId: escrow.parties?.find(p => p.role === 'seller')?.partyId || '',
        eventType: 'data_escrow_verified',
        referenceId: escrowId,
        txSignature: `vcap_${parId}`, // Simulated transaction signature
        hash: crypto.createHash('sha256').update(JSON.stringify(verificationResult)).digest('hex'),
        explorerUrl: `https://solscan.io/tx/vcap_${parId}`, // Placeholder
        status: 'confirmed',
        settlementReceiptSignature: body.sourceUrl || `data_hash_${body.deliveredDataHash}`, // Use sourceUrl or data hash as receipt
        buyerAgentId: escrow.parties?.find(p => p.role === 'buyer')?.partyId || '',
        sellerAgentId: escrow.parties?.find(p => p.role === 'seller')?.partyId || '',
        dataHash: body.deliveredDataHash,
      },
    });

    logger.info(`[VCAP] PAR record created for escrow ${escrowId} verification`);

    return res.json({
      success: true,
      message: 'Data escrow verified successfully',
      result: verificationResult,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid request data', details: error.errors });
    }
    logger.error(`[VCAP] Verification error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
