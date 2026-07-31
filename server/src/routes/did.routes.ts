import { Router } from 'express';
import { getDidDocument } from '../controllers/vc.controller';

const router = Router();

// Endpoint for W3C did:web specification
router.get('/did.json', getDidDocument);

export default router;
