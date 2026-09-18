import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  createEscrow,
  fundEscrow,
  releaseEscrow,
  refundEscrow,
  raiseDispute,
  getEscrow,
  listEscrows,
} from '../controllers/solanaEscrow.controller';

const router = Router();

// ── Solana On-Chain Escrow Routes ─────────────────────────────────────────────

// POST /api/v1/solana-escrow/create — create escrow on-chain
router.post('/create', authenticate, createEscrow);

// POST /api/v1/solana-escrow/:id/fund — fund escrow
router.post('/:id/fund', authenticate, fundEscrow);

// POST /api/v1/solana-escrow/:id/release — release to seller
router.post('/:id/release', authenticate, releaseEscrow);

// POST /api/v1/solana-escrow/:id/refund — refund to buyer
router.post('/:id/refund', authenticate, refundEscrow);

// POST /api/v1/solana-escrow/:id/dispute — raise dispute
router.post('/:id/dispute', authenticate, raiseDispute);

// GET /api/v1/solana-escrow/:id — get escrow state
router.get('/:id', authenticate, getEscrow);

// GET /api/v1/solana-escrow/list/:user — list escrows for a user
router.get('/list/:user', authenticate, listEscrows);

export default router;
