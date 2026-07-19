import { Router } from 'express';
import { LoanService } from '../services/loan.service';
import { authenticate } from '../middleware/auth.middleware';

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

export default router;
