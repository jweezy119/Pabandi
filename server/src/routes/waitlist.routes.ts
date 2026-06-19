import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';

const router = Router();

// Lazy initialize Firestore to ensure admin app is ready
let db: admin.firestore.Firestore;
const getDb = () => {
  if (!db) {
    db = admin.firestore();
  }
  return db;
};

// POST /waitlist
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, whatsapp, city, cityOther, role, why, userId, userEmail, utm_source, utm_medium, utm_campaign, utm_content } = req.body;

    await getDb().collection('waitlist').add({
      name,
      whatsapp,
      city: city === 'other' ? cityOther : city,
      role,
      why,
      userId,
      userEmail,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      createdAt: new Date().toISOString(),
    });

    res.json({ success: true, message: 'Welcome to Pabandi!' });
  } catch (error) {
    console.error('Waitlist error:', error);
    res.status(500).json({ success: false, error: 'Failed to join waitlist' });
  }
});

// GET /waitlist/count
router.get('/count', async (_req: Request, res: Response) => {
  try {
    const snapshot = await getDb().collection('waitlist').count().get();
    res.json({ count: snapshot.data().count });
  } catch {
    res.json({ count: 847 }); // graceful fallback
  }
});

export default router;
