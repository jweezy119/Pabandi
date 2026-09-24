"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const mudarabah_controller_1 = require("../controllers/mudarabah.controller");
const router = (0, express_1.Router)();
// ── Public routes ───────────────────────────────────────────────────
router.get('/pools', mudarabah_controller_1.getAllPools);
router.get('/pools/featured', mudarabah_controller_1.getFeaturedPools);
router.get('/pools/:id', mudarabah_controller_1.getPoolById);
router.get('/pools/:id/transparency', mudarabah_controller_1.getTransparencyData);
router.get('/pools/:id/distributions/public', mudarabah_controller_1.getPoolDistributionsPublic);
router.get('/pools/:id/investments', mudarabah_controller_1.getPoolInvestments);
router.post('/pools/validate', mudarabah_controller_1.validatePool);
// ── Authenticated: Investments ──────────────────────────────────────
router.get('/investments/me', auth_middleware_1.authenticate, mudarabah_controller_1.getMyInvestments);
router.get('/pools/me', auth_middleware_1.authenticate, mudarabah_controller_1.getMyPools);
// ── Authenticated: Pool management (business owner) ─────────────────
router.post('/pools', auth_middleware_1.authenticate, mudarabah_controller_1.createPool);
router.patch('/pools/:id', auth_middleware_1.authenticate, mudarabah_controller_1.updatePool);
router.post('/pools/:id/close', auth_middleware_1.authenticate, mudarabah_controller_1.closePool);
router.delete('/pools/:id', auth_middleware_1.authenticate, mudarabah_controller_1.closePool);
router.post('/pools/:id/validate', auth_middleware_1.authenticate, mudarabah_controller_1.validateExistingPool);
// ── Authenticated: Invest / Withdraw ────────────────────────────────
router.post('/pools/:id/invest', auth_middleware_1.authenticate, mudarabah_controller_1.investInPool);
router.post('/pools/:id/withdraw', auth_middleware_1.authenticate, mudarabah_controller_1.withdrawInvestment);
// ── Authenticated: Profit distribution (business owner) ─────────────
router.post('/pools/:id/distribute', auth_middleware_1.authenticate, mudarabah_controller_1.distributeProfits);
router.get('/pools/:id/distributions', auth_middleware_1.authenticate, mudarabah_controller_1.getPoolDistributions);
exports.default = router;
//# sourceMappingURL=mudarabah.routes.js.map