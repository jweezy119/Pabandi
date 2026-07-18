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
import { listAdminPlugins, getAdminPlugin, updateAdminPlugin } from '../services/openwa_admin.service';

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

router.get('/openwa/plugins', (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const plugins = listAdminPlugins();
    res.json({ success: true, data: { plugins, source: 'openwa_catalog' } });
  } catch (error) {
    next(error);
  }
});

router.get('/openwa/plugins/:id', (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const plugin = getAdminPlugin(req.params.id);
    if (!plugin) {
      return res.status(404).json({ success: false, message: 'Plugin not found' });
    }
    res.json({ success: true, data: { plugin } });
  } catch (error) {
    next(error);
  }
});

router.patch('/openwa/plugins/:id', (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const plugin = updateAdminPlugin(req.params.id, req.body || {});
    res.json({ success: true, data: { plugin } });
  } catch (error) {
    next(error);
  }
});

export default router;
