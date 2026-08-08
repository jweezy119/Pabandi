import { Router, Request, Response } from 'express';
import { LoanService } from '../services/loan.service';
import { authenticate } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';

const router = Router();
const loanService = new LoanService();

/**
 * @route GET /api/v1/loans/power
 * @desc Get max borrowing power and LTV ratio
 */
router.get('/power', authenticate, async (req: any, res) => {
  try {
    const power = await loanService.calculateBorrowingPower(req.user.id);
    res.json(power);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route POST /api/v1/loans/request
 * @desc Request a collateralized loan
 */
router.post('/request', authenticate, async (req: any, res) => {
  try {
    const { usdcAmount } = req.body;
    if (!usdcAmount || usdcAmount <= 0) {
      return res.status(400).json({ error: 'Valid USDC amount required' });
    }

    const loan = await loanService.requestLoan(req.user.id, Number(usdcAmount));
    res.status(201).json({ message: 'Loan issued successfully', loan });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route POST /api/v1/loans/:id/repay
 * @desc Repay a loan to unlock collateral
 */
router.post('/:id/repay', authenticate, async (req: any, res) => {
  try {
    const loanId = req.params.id;
    const result = await loanService.repayLoan(req.user.id, loanId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route GET /api/v1/loans/reputation/quote
 * @desc Quote a collateral-FREE reputation loan (priced off Trust Passport band)
 */
router.get('/reputation/quote', authenticate, async (req: any, res) => {
  try {
    const quote = await loanService.quoteReputationLoan(req.user.id);
    res.json(quote);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route POST /api/v1/loans/reputation/request
 * @desc Issue a collateral-FREE reputation loan (no PAB lock)
 */
router.post('/reputation/request', authenticate, async (req: any, res) => {
  try {
    const { usdcAmount } = req.body;
    if (!usdcAmount || usdcAmount <= 0) return res.status(400).json({ error: 'Valid USDC amount required' });
    const loan = await loanService.requestReputationLoan(req.user.id, Number(usdcAmount));
    res.status(201).json({ message: 'Reputation loan issued (no collateral locked)', loan });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;

// Migrate new Loan columns (Cloud Run FS read-only -> raw SQL)
router.post('/migrate', async (req: Request, res: Response) => {
  try {
    const stmts = [
      // loanType may exist as a legacy enum in the DB; force it to TEXT
      `DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Loan' AND column_name='loanType') THEN ALTER TABLE "Loan" ALTER COLUMN "loanType" TYPE TEXT USING "loanType"::text; END IF; END $$;`,
      `ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "band" TEXT`,
      `ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "reputationCapUsdc" DOUBLE PRECISION NOT NULL DEFAULT 0`,
      `ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "feePct" DOUBLE PRECISION NOT NULL DEFAULT 5`,
    ];
    for (const s of stmts) await prisma.$executeRawUnsafe(s);
    res.json({ success: true, message: 'Loan columns migrated' });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});
