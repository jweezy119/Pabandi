import { Request, Response } from 'express';
import { offrampService } from '../services/offramp.service';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { prisma } from '../utils/database';

const RequestIntentSchema = z.object({
  amountUsdc: z.number().positive(),
  minRatePkr: z.number().positive(),
  destinationType: z.enum(['JazzCash', 'Easypaisa', 'Raast', 'bank']),
  destinationRef: z.string().min(3),
  customerWallet: z.string().min(10)
});

const SubmitProofSchema = z.object({
  intentId: z.string().cuid(),
  lpWallet: z.string().min(10),
  imageBase64: z.string().startsWith('data:image/')
});

export class OfframpController {
  
  async requestIntent(req: Request, res: Response) {
    try {
      const parsed = RequestIntentSchema.parse(req.body);
      const idempotencyKey = req.headers['x-idempotency-key'] as string | undefined;

      const intent = await offrampService.requestIntent(
        parsed.customerWallet,
        parsed.amountUsdc,
        parsed.minRatePkr,
        parsed.destinationType,
        parsed.destinationRef,
        undefined,
        idempotencyKey
      );

      res.status(201).json({
        success: true,
        intentId: intent.id,
        status: intent.status,
        lockedTxHash: intent.lockedTxHash
      });
    } catch (error: any) {
      logger.error(`[OfframpController] requestIntent error: ${error.message}`);
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async submitProof(req: Request, res: Response) {
    try {
      const parsed = SubmitProofSchema.parse(req.body);

      const verifyResult = await offrampService.submitProof(
        parsed.intentId,
        parsed.lpWallet,
        parsed.imageBase64
      );

      res.status(200).json({
        success: true,
        autoApproved: verifyResult.isValid,
        confidence: verifyResult.confidence,
        nextAction: verifyResult.isValid ? 'FUNDS_RELEASED' : 'DISPUTE_OPENED',
        extracted: verifyResult.fields
      });
    } catch (error: any) {
      logger.error(`[OfframpController] submitProof error: ${error.message}`);
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async getIntentStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const intent = await prisma.offrampIntent.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          customerWallet: true,
          amountUsdc: true,
          destinationType: true,
          requestedAt: true,
          matchedAt: true,
          settledAt: true,
          expiresAt: true
        }
      });

      if (!intent) {
        return res.status(404).json({ success: false, error: 'Intent not found' });
      }

      res.status(200).json({ success: true, intent });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getLpIntents(req: Request, res: Response) {
    try {
      const lpWallet = req.query.wallet as string;
      if (!lpWallet) {
        return res.status(400).json({ success: false, error: 'Wallet address required' });
      }

      const intents = await prisma.offrampIntent.findMany({
        where: { lpWallet, status: 'MATCHED' },
        select: {
          id: true,
          status: true,
          amountUsdc: true,
          minRatePkr: true,
          destinationType: true,
          destinationRef: true,
          expiresAt: true
        }
      });

      res.status(200).json({ success: true, intents });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const offrampController = new OfframpController();
