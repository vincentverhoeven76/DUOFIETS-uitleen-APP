// src/config.ts
// Beveiligt Firebase configuraties zodat er GEEN API keys zichtbaar worden in de GitHub repository.

interface FirebaseConfigShape {
  apiKey: string;
  projectId: string;
  appId: string;
  firestoreDatabaseId: string;
  authDomain?: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

let localFileConfig: Partial<FirebaseConfigShape> = {};

try {
  // Dynamische import van het lokale configuratiebestand.
  // Dit bestand staat in .gitignore en wordt NOOIT naar GitHub gepusht.
  const local = await import('../firebase-applet-config.json');
  localFileConfig = local.default || local;
} catch {
  // Op GitHub Pages of een schone clone is dit bestand afwezig; dat is verwacht.
}

export const firebaseConfig: FirebaseConfigShape = {
  // Prioriteit 1: GitHub Actions Secrets / Environment Variables
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || localFileConfig.apiKey || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || localFileConfig.projectId || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || localFileConfig.appId || '',
  firestoreDatabaseId:
    import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID ||
    localFileConfig.firestoreDatabaseId ||
    '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || localFileConfig.authDomain || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || localFileConfig.storageBucket || '',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || localFileConfig.messagingSenderId || '',
};

export const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);
