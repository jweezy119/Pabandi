import { Router } from 'express';
import { getPublicUserProfile, searchUsers } from '../controllers/user.controller';

const router = Router();

// Public routes for searching and viewing users
router.get('/', searchUsers);
router.get('/:id', getPublicUserProfile);

export default router;
