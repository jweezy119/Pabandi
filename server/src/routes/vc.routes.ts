import { Router, Request, Response } from 'express';
import { didService } from '../services/vc/did.service';
import { vcService } from '../services/vc/vc.service';
import { authenticate } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';

const router = Router();

/**
 * GET /.well-known/did.json
 * W3C DID Document for did:web:pabandi.com
 */
router.get('/did.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/did+json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json(didService.getDidDocument());
});

/**
 * GET /api/v1/vc/did
 * Get DID info
 */
router.get('/did', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      did: didService.getDid(),
      didDocument: didService.getDidDocument(),
    },
  });
});

/**
 * POST /api/v1/vc/issue/trust-passport
 * Issue a Verifiable Credential for the authenticated user's trust passport
 */
router.post('/issue/trust-passport', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });

    const passport = await prisma.trustPassport.findUnique({ where: { userId } });
    if (!passport) return res.status(404).json({ success: false, error: 'No trust passport found' });

    const vc = await vcService.issueTrustPassportCredential({
      passportId: passport.id,
      handle: passport.handle,
      score: passport.score || 500,
      level: passport.level || undefined,
    });

    res.json({ success: true, data: vc });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/v1/vc/issue/job-completion
 * Issue a Verifiable Credential for a completed job
 */
router.post('/issue/job-completion', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });

    const { projectId } = req.body;
    if (!projectId) return res.status(400).json({ success: false, error: 'projectId required' });

    const passport = await prisma.trustPassport.findUnique({ where: { userId } });
    if (!passport) return res.status(404).json({ success: false, error: 'No trust passport found' });

    const project = await prisma.agentProject.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
    if (project.status !== 'COMPLETED') return res.status(400).json({ success: false, error: 'Project must be completed' });

    const vc = await vcService.issueJobCompletionCredential({
      passportId: passport.id,
      projectId: project.id,
      projectTitle: project.title,
      amount: project.budgetUsd,
      completedAt: project.updatedAt,
    });

    res.json({ success: true, data: vc });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/v1/vc/verify
 * Verify a Verifiable Credential
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ success: false, error: 'credential required' });

    const result = await vcService.verifyCredential(credential);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
