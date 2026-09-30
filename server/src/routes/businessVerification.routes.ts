import { Router, Response } from 'express';
import { authenticate, AuthRequest, authorize } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import { apiLimiter, writeLimiter } from '../middleware/rateLimit.middleware';
import { logger } from '../utils/logger';

const router = Router();

router.get('/status', authenticate, apiLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.businessId || String(req.query.businessId);
    if (!businessId) return res.status(400).json({ success: false, error: 'businessId required' });

    const verification = await prisma.businessVerification.findUnique({ where: { businessId } });
    const documents = await prisma.businessDocument.findMany({ where: { businessId } });
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { isVerified: true, verifiedAt: true, name: true },
    });

    return res.json({
      success: true,
      data: {
        status: verification?.status || 'NOT_SUBMITTED',
        documents: documents.map(d => ({
          id: d.id,
          fileName: d.fileName,
          fileType: d.fileType,
          category: d.category,
          verified: d.verified,
          uploadedAt: d.uploadedAt,
          expiresAt: d.expiresAt,
        })),
        rejectionReason: verification?.rejectionReason || null,
        submittedAt: verification?.submittedAt || null,
        reviewedAt: verification?.reviewedAt || null,
        isVerified: business?.isVerified || false,
        verifiedAt: business?.verifiedAt || null,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[BusinessVerification] status error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

router.post('/submit', authenticate, writeLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.businessId || String(req.body.businessId);
    if (!businessId) return res.status(400).json({ success: false, error: 'businessId required' });

    const { documentType, documentUrl, documentName, notes } = req.body;
    if (!documentUrl) return res.status(400).json({ success: false, error: 'Document URL required' });

    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) return res.status(404).json({ success: false, error: 'Business not found' });

    const existing = await prisma.businessVerification.findUnique({ where: { businessId } });
    if (existing?.status === 'PENDING') {
      return res.status(400).json({ success: false, error: 'Verification already pending' });
    }

    const verification = await prisma.businessVerification.upsert({
      where: { businessId },
      create: {
        businessId,
        status: 'PENDING',
        documentType: documentType || 'business_license',
        documentUrl,
        documentName: documentName || 'Document',
        notes: notes || null,
      },
      update: {
        status: 'PENDING',
        documentType: documentType || 'business_license',
        documentUrl,
        documentName: documentName || 'Document',
        notes: notes || null,
        submittedAt: new Date(),
        reviewedAt: null,
        rejectionReason: null,
      },
    });

    await prisma.businessDocument.create({
      data: {
        businessId,
        fileName: documentName || 'Document',
        fileUrl: documentUrl,
        fileType: documentType || 'business_license',
        fileSize: 0,
        category: documentType || 'other',
      },
    });

    return res.json({ success: true, data: verification });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[BusinessVerification] submit error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

router.get('/pending', authenticate, authorize('ADMIN'), apiLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const pending = await prisma.businessVerification.findMany({
      where: { status: 'PENDING' },
      include: { business: { select: { id: true, name: true, email: true, phone: true, category: true } } },
      orderBy: { submittedAt: 'asc' },
    });
    return res.json({ success: true, data: pending });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[BusinessVerification] pending error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

router.post('/review', authenticate, authorize('ADMIN'), writeLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { businessId, action, reason } = req.body;
    if (!businessId || !action) return res.status(400).json({ success: false, error: 'businessId and action required' });
    if (!['APPROVED', 'REJECTED'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    const verification = await prisma.businessVerification.findUnique({ where: { businessId } });
    if (!verification) return res.status(404).json({ success: false, error: 'Verification not found' });

    const updated = await prisma.businessVerification.update({
      where: { businessId },
      data: {
        status: action,
        reviewedAt: new Date(),
        reviewedBy: req.user!.id,
        rejectionReason: action === 'REJECTED' ? reason || 'Does not meet requirements' : null,
      },
    });

    if (action === 'APPROVED') {
      await prisma.business.update({
        where: { id: businessId },
        data: { isVerified: true, verifiedAt: new Date() },
      });
      await prisma.businessDocument.updateMany({
        where: { businessId },
        data: { verified: true },
      });
    }

    return res.json({ success: true, data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[BusinessVerification] review error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

export default router;
