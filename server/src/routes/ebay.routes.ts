import { Router } from 'express';
import { ebayAuthRedirect, ebayAuthCallback } from '../controllers/ebay.controller';

const router = Router();

// Starts the OAuth Flow
router.get('/auth', ebayAuthRedirect);

// Callback from eBay OAuth
router.get('/callback', ebayAuthCallback);

export default router;
