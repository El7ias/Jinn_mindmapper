/**
 * Firebase Configuration & SDK Initialization
 * 
 * Phase 3.0 — Infrastructure Foundation
 * 
 * ⚠️ SETUP REQUIRED:
 *   1. Create a Firebase project at https://console.firebase.google.com
 *   2. Enable Authentication (Google Sign-In)
 *   3. Create a Firestore database
 *   4. Copy your config values below
 * 
 * The config can also be loaded from environment variables via Vite:
 *   VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, etc.
 */

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// Firebase configuration — replace with your project's config
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || 'YOUR_API_KEY',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || 'YOUR_PROJECT.firebaseapp.com',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || 'YOUR_PROJECT_ID',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || 'YOUR_PROJECT.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_ID       || '000000000000',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || '1:000000000000:web:0000000000000000',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Connect to emulators in development
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFirestoreEmulator(db, 'localhost', 8080);
  console.info('[Firebase] Connected to emulators');
}

/**
 * Check if Firebase is properly configured (not using placeholder values)
 */
export function isFirebaseConfigured() {
  return firebaseConfig.apiKey !== 'YOUR_API_KEY' 
    && firebaseConfig.projectId !== 'YOUR_PROJECT_ID';
}

export { app, auth, db };
export default app;
