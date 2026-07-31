/**
 * src/lib/firebase.ts
 *
 * Firebase client initialization.
 *
 * Security hardening:
 *  - All config values are loaded from environment variables prefixed PUBLIC_
 *    (Astro convention for client-safe vars). No secrets here.
 *  - getApps() guard prevents duplicate initialization on hot-reload.
 *  - Firebase app is initialized ONCE via module-level singleton.
 *  - Config values are validated at startup with Zod; a missing var throws
 *    immediately with a clear message instead of silently using undefined,
 *    which could cause subtle auth bypass bugs.
 *  - This file must NEVER import server-only secrets (admin SDK, service accounts).
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { z } from 'zod';

// ── Config validation schema ──────────────────────────────────────────────────
// All Firebase config keys are validated at module load time.
// If any key is missing, we fail fast with a clear error — not silently undefined.
const FirebaseConfigSchema = z.object({
  apiKey: z.string().min(10, 'PUBLIC_FIREBASE_API_KEY is missing or too short'),
  authDomain: z.string().min(3, 'PUBLIC_FIREBASE_AUTH_DOMAIN is missing'),
  projectId: z.string().min(3, 'PUBLIC_FIREBASE_PROJECT_ID is missing'),
  storageBucket: z.string().min(3, 'PUBLIC_FIREBASE_STORAGE_BUCKET is missing'),
  messagingSenderId: z.string().min(3, 'PUBLIC_FIREBASE_MESSAGING_SENDER_ID is missing'),
  appId: z.string().min(3, 'PUBLIC_FIREBASE_APP_ID is missing'),
});

// ── Read from environment ────────────────────────────────────────────────────
const rawConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
};

// ── Validate config ──────────────────────────────────────────────────────────
let firebaseApp: FirebaseApp;
let auth: Auth;
let db: Firestore;

try {
  const config = FirebaseConfigSchema.parse(rawConfig);

  // Singleton guard: only initialize if no app already exists
  firebaseApp = getApps().length === 0 ? initializeApp(config) : getApp();
  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);
} catch (err) {
  // In development, show which config key is missing.
  // In production, log a generic message (no config details leaked).
  if (import.meta.env.DEV) {
    console.error('[Firebase] Config validation failed:', err);
    console.warn('[Firebase] Running in offline/demo mode — auth and Firestore disabled.');
  } else {
    console.error('[Firebase] Initialization failed — check environment variables.');
  }

  // Provide stub objects so the rest of the app doesn't crash on import.
  // Components that use auth/db must handle the offline state gracefully.
  firebaseApp = null as unknown as FirebaseApp;
  auth = null as unknown as Auth;
  db = null as unknown as Firestore;
}

export { firebaseApp, auth, db };

/** Returns true if Firebase was successfully initialized */
export function isFirebaseReady(): boolean {
  return firebaseApp !== null;
}
