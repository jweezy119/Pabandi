import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  getAllPools,
  getPoolById,
  getFeaturedPools,
  createPool,
  updatePool,
  closePool,
  validatePool,
  validateExistingPool,
  investInPool,
  withdrawInvestment,
  getMyInvestments,
  getMyPools,
  distributeProfits,
  getPoolDistributions,
  getPoolDistributionsPublic,
  getPoolInvestments,
  getTransparencyData,
} from '../controllers/mudarabah.controller';

const router = Router();

// ── Public routes ───────────────────────────────────────────────────
router.get('/pools', getAllPools);
router.get('/pools/featured', getFeaturedPools);
router.get('/pools/:id', getPoolById);
router.get('/pools/:id/transparency', getTransparencyData);
router.get('/pools/:id/distributions/public', getPoolDistributionsPublic);
router.get('/pools/:id/investments', getPoolInvestments);
router.post('/pools/validate', validatePool);

// ── Authenticated: Investments ──────────────────────────────────────
router.get('/investments/me', authenticate, getMyInvestments);
router.get('/pools/me', authenticate, getMyPools);

// ── Authenticated: Pool management (business owner) ─────────────────
router.post('/pools', authenticate, createPool);
router.patch('/pools/:id', authenticate, updatePool);
router.post('/pools/:id/close', authenticate, closePool);
router.delete('/pools/:id', authenticate, closePool);
router.post('/pools/:id/validate', authenticate, validateExistingPool);

// ── Authenticated: Invest / Withdraw ────────────────────────────────
router.post('/pools/:id/invest', authenticate, investInPool);
router.post('/pools/:id/withdraw', authenticate, withdrawInvestment);

// ── Authenticated: Profit distribution (business owner) ─────────────
router.post('/pools/:id/distribute', authenticate, distributeProfits);
router.get('/pools/:id/distributions', authenticate, getPoolDistributions);

export default router;
