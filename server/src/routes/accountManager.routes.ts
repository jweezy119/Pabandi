import { Router } from 'express';
import { accountManagerController } from '../controllers/accountManager.controller';
// import { authenticateToken, requireAdmin } from '../middleware/auth.middleware'; 
// Assuming auth middleware exists, placeholder imports used here.

const router = Router();

// In a real implementation, you would use auth middlewares like so:
// router.post('/admin/account-managers', authenticateToken, requireAdmin, accountManagerController.createPartner);
// router.put('/admin/account-managers/config', authenticateToken, requireAdmin, accountManagerController.updateConfig);
// router.get('/me', authenticateToken, accountManagerController.getMe);
// router.get('/referrals', authenticateToken, accountManagerController.getReferrals);
// router.get('/ledger', authenticateToken, accountManagerController.getLedger);
// router.get('/payouts', authenticateToken, accountManagerController.getPayouts);

router.post('/admin', accountManagerController.createPartner);
router.put('/admin/config', accountManagerController.updateConfig);

router.get('/me', accountManagerController.getMe);
router.get('/referrals', accountManagerController.getReferrals);
router.get('/ledger', accountManagerController.getLedger);
router.get('/payouts', accountManagerController.getPayouts);

export default router;
