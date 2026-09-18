import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  getAllPools,
  getPoolById,
  createPool,
  updatePool,
  closePool,
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
router.get('/pools/:id', getPoolById);
router.get('/transparency/:id', getTransparencyData);

// ── Authenticated: Investments ──────────────────────────────────────
router.get('/my-investments', authenticate, getMyInvestments);
router.get('/my-pools', authenticate, getMyPools);

// ── Authenticated: Pool management (business owner) ─────────────────
router.post('/pools', authenticate, createPool);
router.patch('/pools/:id', authenticate, updatePool);
router.delete('/pools/:id', authenticate, closePool);

// ── Authenticated: Invest / Withdraw ────────────────────────────────
router.post('/pools/:id/invest', authenticate, investInPool);
router.post('/pools/:id/withdraw', authenticate, withdrawInvestment);

// ── Authenticated: Profit distribution (business owner) ─────────────
router.post('/pools/:id/distribute', authenticate, distributeProfits);
router.get('/pools/:id/distributions', authenticate, getPoolDistributions);

export default router;
