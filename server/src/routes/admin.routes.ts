import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  getAdminStats,
  getAllUsers,
  getUserDetail,
  getAllReservations,
  getAllBusinesses,
  verifyBusiness,
  updateUserRole,
} from '../controllers/admin.controller';
import { AuthRequest } from '../middleware/auth.middleware';
import { Response, NextFunction } from 'express';

const router = Router();

// All admin routes require auth + ADMIN role
router.use(authenticate);
router.use((req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
});

router.get('/stats', getAdminStats);
router.get('/users', getAllUsers);
router.get('/users/:id', getUserDetail);
router.patch('/users/:id/role', updateUserRole);
router.get('/reservations', getAllReservations);
router.get('/businesses', getAllBusinesses);
router.patch('/businesses/:id/verify', verifyBusiness);

export default router;
