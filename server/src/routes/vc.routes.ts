import { Router } from 'express';
import { issueCredential, listCredentials, revokeCredential, verifyCredential, getStatusList, createPresentation } from '../controllers/vc.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Public routes
router.post('/verify', verifyCredential);
router.get('/status-list/:index', getStatusList);

// Protect subsequent routes with auth
router.use(authenticate);

router.post('/issue', issueCredential);
router.post('/presentation', createPresentation);
router.get('/', listCredentials);
router.post('/revoke/:id', revokeCredential);

export default router;
