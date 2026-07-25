import { Router, Request, Response, NextFunction } from 'express';
import { offrampController } from '../controllers/offramp.controller';

const router = Router();

// Middleware: Simple LP API Key check for Phase 0
function lpAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.OFFRAMP__LP_API_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized LP' });
  }
  next();
}

// ---------------------------
// Customer Endpoints
// ---------------------------

// Request an offramp intent
router.post('/intent', (req, res) => {
  offrampController.requestIntent(req, res);
});

// Check intent status
router.get('/intent/:id', (req, res) => {
  offrampController.getIntentStatus(req, res);
});


// ---------------------------
// Liquidity Provider Endpoints
// ---------------------------

// Fetch assigned intents
router.get('/lp/intents', lpAuthMiddleware, (req, res) => {
  offrampController.getLpIntents(req, res);
});

// Submit proof of fiat payment
router.post('/lp/submit-proof', lpAuthMiddleware, (req, res) => {
  offrampController.submitProof(req, res);
});

export default router;
