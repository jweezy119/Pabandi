import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { 
  getPublicUserProfile, 
  searchUsers, 
  deleteAccount, 
  exportUserData 
} from '../controllers/user.controller';

const router = Router();

// Public routes for searching and viewing users
router.get('/', searchUsers);
router.get('/:id', getPublicUserProfile);

// Authenticated user routes (GDPR / account management)
router.use(authenticate); // All routes below require authentication

// DELETE /api/v1/users/delete-account - Delete user account with cascading anonymization
router.delete('/delete-account', deleteAccount);

// GET /api/v1/users/export-data - Export all user data (GDPR Art. 20)
router.get('/export-data', exportUserData);

export default router;
