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
  getTransparencyData,
} from '../controllers/mudarabah.controller';

const router = Router();

// ── Public routes ───────────────────────────────────────────────────
router.get('/pools', getAllPools);
router.get('/pools/featured', getFeaturedPools);
router.get('/pools/:id', getPoolById);
router.get('/transparency/:id', getTransparencyData);
router.post('/pools/validate', validatePool);

// ── Authenticated: Investments ──────────────────────────────────────
router.get('/my-investments', authenticate, getMyInvestments);
router.get('/my-pools', authenticate, getMyPools);

// ── Authenticated: Pool management (business owner) ─────────────────
router.post('/pools', authenticate, createPool);
router.patch('/pools/:id', authenticate, updatePool);
router.delete('/pools/:id', authenticate, closePool);
router.post('/pools/:id/validate', authenticate, validateExistingPool);

// ── Authenticated: Invest / Withdraw ────────────────────────────────
router.post('/pools/:id/invest', authenticate, investInPool);
router.post('/pools/:id/withdraw', authenticate, withdrawInvestment);

// ── Authenticated: Profit distribution (business owner) ─────────────
router.post('/pools/:id/distribute', authenticate, distributeProfits);
router.get('/pools/:id/distributions', authenticate, getPoolDistributions);

export default router;
