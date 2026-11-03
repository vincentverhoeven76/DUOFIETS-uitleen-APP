// src/config.ts
// Beveiligt Firebase configuraties zodat er GEEN API keys zichtbaar worden in de GitHub repository.
import localConfig from 'virtual:firebase-config';

interface FirebaseConfigShape {
  apiKey: string;
  projectId: string;
  appId: string;
  firestoreDatabaseId: string;
  authDomain?: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

const local: Partial<FirebaseConfigShape> = localConfig || {};

export const firebaseConfig: FirebaseConfigShape = {
  // Prioriteit 1: GitHub Actions Secrets / Environment Variables
  // Prioriteit 2: Lokaal ontwikkelbestand (staat in .gitignore en wordt niet gepusht naar GitHub)
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || local.apiKey || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || local.projectId || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || local.appId || '',
  firestoreDatabaseId:
    import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID ||
    local.firestoreDatabaseId ||
    '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || local.authDomain || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || local.storageBucket || '',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || local.messagingSenderId || '',
};

export const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);
