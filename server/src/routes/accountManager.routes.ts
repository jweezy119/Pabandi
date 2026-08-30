import { Router } from 'express';
import { accountManagerController } from '../controllers/accountManager.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// Partner (Account Manager) program endpoints.
// Admin-only: create a partner + tune the program config.
router.post('/admin', authenticate, authorize('ADMIN'), accountManagerController.createPartner);
router.put('/admin/config', authenticate, authorize('ADMIN'), accountManagerController.updateConfig);

// Authenticated partner dashboard.
router.get('/me', authenticate, accountManagerController.getMe);
router.get('/referrals', authenticate, accountManagerController.getReferrals);
router.get('/ledger', authenticate, accountManagerController.getLedger);
router.get('/payouts', authenticate, accountManagerController.getPayouts);
// Cash out accrued (unbilled) referral commissions into a payout request.
router.post('/payout/request', authenticate, accountManagerController.requestPayout);

export default router;
