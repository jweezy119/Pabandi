import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { apiKeyAuth, ApiKeyRequest } from '../middleware/apiKey.middleware';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const router = Router();

// POST /api/v1/m2m/escrow/:id/subcontract
router.post('/escrow/:id/subcontract', apiKeyAuth, async (req: ApiKeyRequest, res: Response) => {
  try {
    const { id: masterEscrowId } = req.params;
    const { subcontracts } = req.body as {
      subcontracts: Array<{ providerPassportId: string; amount: number; deliverableHash: string }>;
    };

    const agentId = req.apiClient?.id;
    if (!agentId || !req.apiClient?.isAgent) {
      return res.status(401).json({ success: false, error: 'Parent Agent API key required' });
    }

    const masterEscrow = await prisma.agentEscrow.findUnique({
      where: { id: masterEscrowId },
      include: { project: true, childEscrows: true },
    });

    if (!masterEscrow) {
      return res.status(404).json({ success: false, error: 'Master escrow not found' });
    }

    // Verify parent agent owns this project
    if ((masterEscrow.project as any).posterId !== agentId) {
      return res.status(403).json({ success: false, error: 'Not authorized - only parent agent can subcontract' });
    }

    // Calculate total allocation
    const totalAllocated = subcontracts.reduce((sum, s) => sum + s.amount, 0);
    const alreadyAllocated = masterEscrow.childEscrows.reduce((sum, c) => sum + c.totalAmount, 0);
    
    if (totalAllocated + alreadyAllocated > masterEscrow.totalAmount) {
      return res.status(400).json({ 
        success: false, 
        error: 'Insufficient funds. Total allocation exceeds master escrow amount.' 
      });
    }

    const createdChildren = [];

    for (const subcontract of subcontracts) {
      // Verify deliverable hash
      const hash = subcontract.deliverableHash.trim().toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(hash)) {
        return res.status(400).json({ success: false, error: 'Invalid deliverableHash' });
      }

      // Create child escrow
      const childEscrow = await prisma.agentEscrow.create({
        data: {
          projectId: `${masterEscrow.projectId}-sub-${crypto.randomBytes(4).toString('hex')}`,
          parentEscrowId: masterEscrowId,
          providerPassportId: subcontract.providerPassportId,
          deliverableHash: hash,
          totalAmount: subcontract.amount,
          releaseAmount: subcontract.amount,
          platformFee: subcontract.amount * 0.02,
          status: 'FUNDED',
        },
      });

      createdChildren.push(childEscrow);
    }

    // Update master escrow status
    await prisma.agentEscrow.update({
      where: { id: masterEscrowId },
      data: { status: 'subcontracted' },
    });

    return res.json({
      success: true,
      data: {
        masterEscrowId,
        childEscrows: createdChildren,
        totalAllocated: totalAllocated + alreadyAllocated,
        remaining: masterEscrow.totalAmount - (totalAllocated + alreadyAllocated),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[M2M Subcontract] error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

// POST /api/v1/m2m/escrow/:childId/verify
router.post('/escrow/:childId/verify', apiKeyAuth, async (req: ApiKeyRequest, res: Response) => {
  try {
    const { childId } = req.params;
    const { proofOfWork, deliveredHash } = req.body;

    const childEscrow = await prisma.agentEscrow.findUnique({
      where: { id: childId },
      include: { parentEscrow: true },
    });

    if (!childEscrow) {
      return res.status(404).json({ success: false, error: 'Child escrow not found' });
    }

    // Verify deliverable hash matches
    if (childEscrow.deliverableHash && deliveredHash) {
      const delivered = deliveredHash.trim().toLowerCase();
      if (delivered !== childEscrow.deliverableHash) {
        return res.status(400).json({ success: false, error: 'Deliverable hash mismatch' });
      }
    }

    // Mark as delivered
    await prisma.agentEscrow.update({
      where: { id: childId },
      data: { status: 'DELIVERED' },
    });

    return res.json({
      success: true,
      data: {
        childEscrowId: childId,
        status: 'DELIVERED',
        message: 'Proof of work submitted. Awaiting parent approval and release.',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[M2M Subcontract] verify error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

// POST /api/v1/m2m/escrow/:childId/release - Release child escrow funds
router.post('/escrow/:childId/release', apiKeyAuth, async (req: ApiKeyRequest, res: Response) => {
  try {
    const { childId } = req.params;

    const childEscrow = await prisma.agentEscrow.findUnique({
      where: { id: childId },
      include: { parentEscrow: { include: { project: true } } },
    });

    if (!childEscrow) {
      return res.status(404).json({ success: false, error: 'Child escrow not found' });
    }

    const agentId = req.apiClient?.id;
    if (childEscrow.parentEscrow && (childEscrow.parentEscrow.project as any).posterId !== agentId) {
      return res.status(403).json({ success: false, error: 'Only parent agent can release funds' });
    }

    if (childEscrow.status !== 'DELIVERED') {
      return res.status(400).json({ success: false, error: 'Child escrow must be delivered before release' });
    }

    // Release funds to subcontractor
    await prisma.agentEscrow.update({
      where: { id: childId },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });

    // Check if all children are released
    if (childEscrow.parentEscrowId) {
      const allChildren = await prisma.agentEscrow.findMany({
        where: { parentEscrowId: childEscrow.parentEscrowId },
      });
      
      const allReleased = allChildren.every(c => c.status === 'RELEASED');
      if (allReleased) {
        await prisma.agentEscrow.update({
          where: { id: childEscrow.parentEscrowId },
          data: { status: 'COMPLETED', releasedAt: new Date() },
        });
      }
    }

    return res.json({
      success: true,
      data: {
        childEscrowId: childId,
        status: 'RELEASED',
        amount: childEscrow.releaseAmount,
        message: 'Funds released to subcontractor',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[M2M Subcontract] release error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

export default router;
