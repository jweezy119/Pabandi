import { Router } from 'express';
import { issueCredential, listCredentials, revokeCredential, verifyCredential, getStatusList } from '../controllers/vc.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Public routes
router.post('/verify', verifyCredential);
router.get('/status-list/:index', getStatusList);

// Protect subsequent routes with auth
router.use(authenticate);

router.post('/issue', issueCredential);
router.get('/', listCredentials);
router.post('/revoke/:id', revokeCredential);

export default router;
