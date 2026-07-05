import express from 'express';
import { createReview } from '../controllers/pabandiReview.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();

router.post('/', authenticate, createReview);

export default router;
