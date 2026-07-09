import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

const firebaseConfig = {
  // We need your Firebase apiKey and appId to initialize the SDK
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: "pabandi.firebaseapp.com",
  projectId: "pabandi",
  storageBucket: "pabandi.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);

// Initialize App Check with the reCAPTCHA Enterprise Site Key
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider('6LdfKyMtAAAAAD_sRhhQ8R8zZzXfz2oA4YWDExx5'),
  isTokenAutoRefreshEnabled: true
});

export { app, appCheck };
