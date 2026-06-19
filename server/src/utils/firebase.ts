import * as admin from 'firebase-admin';
import { logger } from './logger';

let isInitialized = false;

export const initFirebaseAdmin = () => {
  if (isInitialized) return;

  try {
    if (process.env.FIREBASE_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      isInitialized = true;
      logger.info('Firebase Admin initialized successfully.');
    } else {
      logger.warn('Firebase Admin credentials missing, some features (App Check, Push Notifications) may be disabled.');
    }
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin', error);
  }
};
