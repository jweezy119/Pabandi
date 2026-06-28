import { Router, Response } from 'express';
import { apiKeyAuth, logApiUsage, ApiKeyRequest } from '../middleware/apiKey.middleware';
import {
  verifyPassport,
  checkEligibility,
  recordIncident,
  bindX509Certificate,
  ScoreTier,
} from '../services/passport.service';
import { logger } from '../utils/logger';
import { ecommerceReliabilityPredictor } from '../services/ai/ecommerceReliabilityPredictor';

const router = Router();

// All passport routes require API key authentication and log usage
router.use(apiKeyAuth);
router.use(logApiUsage);

// ── Valid tiers for input validation ──────────────────────────────
const VALID_TIERS: ScoreTier[] = ['Platinum', 'Gold', 'Silver', 'Bronze', 'Unrated'];
const VALID_INCIDENT_TYPES = ['NO_SHOW', 'FRAUD', 'NON_PAYMENT', 'HARASSMENT', 'QUALITY_ISSUE', 'OTHER'];

/**
 * POST /api/v1/passport/verify
 * 
 * Full Passport lookup with optional tier threshold check.
 * 
 * Body: { wallet_address: string, required_tier?: ScoreTier }
 * Returns: Full Passport object + tier check result
 */
router.post('/verify', async (req: ApiKeyRequest, res: Response): Promise<any> => {
  try {
    const { wallet_address, required_tier } = req.body;

    if (!wallet_address || typeof wallet_address !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'wallet_address is required and must be a string.',
      });
    }

    if (required_tier && !VALID_TIERS.includes(required_tier)) {
      return res.status(400).json({
        success: false,
        error: `Invalid required_tier. Must be one of: ${VALID_TIERS.join(', ')}`,
      });
    }

    const result = await verifyPassport(wallet_address, required_tier);

    if (result.status === 'not_found') {
      return res.status(404).json({
        success: false,
        status: 'not_found',
        message: result.message,
      });
    }

    if (result.status === 'below_threshold') {
      return res.status(402).json({
        success: true,
        status: 'below_threshold',
        message: result.message,
        required_tier: result.required_tier,
        actual_tier: result.actual_tier,
        action_required: result.action_required,
        passport: result.passport,
      });
    }

    return res.status(200).json({
      success: true,
      status: 'ok',
      passport: result.passport,
    });
  } catch (error) {
    logger.error('[Passport] /verify error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/**
 * POST /api/v1/passport/eligibility
 * 
 * Lightweight yes/no tier check. Does NOT return the full Passport object.
 * 
 * Body: { wallet_address: string, required_tier: ScoreTier }
 * Returns: { status: "eligible" | "not_eligible", score_tier, action_required? }
 */
router.post('/eligibility', async (req: ApiKeyRequest, res: Response): Promise<any> => {
  try {
    const { wallet_address, required_tier } = req.body;

    if (!wallet_address || typeof wallet_address !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'wallet_address is required and must be a string.',
      });
    }

    if (!required_tier || !VALID_TIERS.includes(required_tier)) {
      return res.status(400).json({
        success: false,
        error: `required_tier is required and must be one of: ${VALID_TIERS.join(', ')}`,
      });
    }

    const result = await checkEligibility(wallet_address, required_tier);

    const statusCode = result.status === 'eligible' ? 200 : 402;
    return res.status(statusCode).json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('[Passport] /eligibility error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/**
 * POST /api/v1/passport/incidents
 * 
 * Report a no-show, fraud, or other incident against a user.
 * This creates a Dispute record and adjusts the user's reliability score.
 * 
 * Body: { wallet_address: string, type: DisputeType, description?: string }
 * Returns: { incident_id, status: "received", score_impact }
 */
router.post('/incidents', async (req: ApiKeyRequest, res: Response): Promise<any> => {
  try {
    const { wallet_address, type, description } = req.body;

    if (!wallet_address || typeof wallet_address !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'wallet_address is required and must be a string.',
      });
    }

    if (!type || !VALID_INCIDENT_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `type is required and must be one of: ${VALID_INCIDENT_TYPES.join(', ')}`,
      });
    }

    const apiClientId = req.apiClient?.id;
    const result = await recordIncident(wallet_address, type, description, apiClientId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'No user found for this wallet address.',
      });
    }

    return res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('[Passport] /incidents error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/**
 * POST /api/v1/passport/bind-x509
 * 
 * Binds an X.509 PKI certificate to a Pabandi wallet identity.
 * This ensures compliance with Chinese GB/Z 185.3 standards for verifiable 
 * machine identity and root CA trust chains.
 * 
 * Body: { wallet_address: string, certificate: string, signed_nonce: string }
 */
router.post('/bind-x509', async (req: ApiKeyRequest, res: Response): Promise<any> => {
  try {
    const { wallet_address, certificate, signed_nonce } = req.body;

    if (!wallet_address || !certificate || !signed_nonce) {
      return res.status(400).json({
        success: false,
        error: 'wallet_address, certificate, and signed_nonce are required.',
      });
    }

    const result = await bindX509Certificate(wallet_address, certificate, signed_nonce);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    logger.error('[Passport] /bind-x509 error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/**
 * POST /api/v1/passport/predict-ecommerce
 * 
 * Predicts the reliability of a buyer or seller on an e-commerce platform.
 * Emphasizes that Pabandi is an intelligence layer and does not process payments.
 * 
 * Body: EcommerceFeatures object
 * Returns: EcommercePredictionResult object
 */
router.post('/predict-ecommerce', async (req: ApiKeyRequest, res: Response): Promise<any> => {
  try {
    const features = req.body;
    
    if (!features || !features.role) {
      return res.status(400).json({
        success: false,
        error: 'Invalid features. "role" (BUYER or SELLER) is required.',
      });
    }

    const result = await ecommerceReliabilityPredictor.predict(features);

    return res.status(200).json({
      success: true,
      prediction: result,
    });
  } catch (error) {
    logger.error('[Passport] /predict-ecommerce error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

export default router;
