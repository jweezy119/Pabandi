import { Router } from 'express';
import { generateApiKey, getApiKeys } from '../controllers/apiKey.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/generate', generateApiKey);
router.get('/', getApiKeys);

export default router;
