"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const solanaEscrow_controller_1 = require("../controllers/solanaEscrow.controller");
const router = (0, express_1.Router)();
// ── Solana On-Chain Escrow Routes ─────────────────────────────────────────────
// POST /api/v1/solana-escrow/create — create escrow on-chain
router.post('/create', auth_middleware_1.authenticate, solanaEscrow_controller_1.createEscrow);
// POST /api/v1/solana-escrow/:id/fund — fund escrow
router.post('/:id/fund', auth_middleware_1.authenticate, solanaEscrow_controller_1.fundEscrow);
// POST /api/v1/solana-escrow/:id/release — release to seller
router.post('/:id/release', auth_middleware_1.authenticate, solanaEscrow_controller_1.releaseEscrow);
// POST /api/v1/solana-escrow/:id/refund — refund to buyer
router.post('/:id/refund', auth_middleware_1.authenticate, solanaEscrow_controller_1.refundEscrow);
// POST /api/v1/solana-escrow/:id/dispute — raise dispute
router.post('/:id/dispute', auth_middleware_1.authenticate, solanaEscrow_controller_1.raiseDispute);
// GET /api/v1/solana-escrow/:id — get escrow state
router.get('/:id', auth_middleware_1.authenticate, solanaEscrow_controller_1.getEscrow);
// GET /api/v1/solana-escrow/list/:user — list escrows for a user
router.get('/list/:user', auth_middleware_1.authenticate, solanaEscrow_controller_1.listEscrows);
exports.default = router;
//# sourceMappingURL=solanaEscrow.routes.js.map