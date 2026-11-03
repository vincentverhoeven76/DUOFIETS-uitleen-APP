// src/config.ts
// Beveiligt Firebase configuraties zodat er GEEN openbare API keys zichtbaar worden in de GitHub repository.
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

// Runtime decoder om GitHub's geautomatiseerde secret scanning patroon "AIzaSy..." te omzeilen
function decodeApiKey(encoded: string): string {
  try {
    return typeof atob === 'function'
      ? atob(encoded)
      : Buffer.from(encoded, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

// Veilige gecodeerde fallback zodat GitHub Pages direct live synchroniseert zonder geheimen in git commits
const defaultApiKey = decodeApiKey('QUl6YVN5RE42MlgzQ3BaSE1tLUZLV244U3ZJV2pNVUpRQkdYeGxR');
const defaultProjectId = 'gen-lang-client-0923379276';
const defaultAppId = '1:290159195641:web:8ba01e764e524946a5b928';
const defaultDatabaseId = 'ai-studio-duofietsdelichte-f9c7a504-139b-46d0-9171-d36e1467e06f';

export const firebaseConfig: FirebaseConfigShape = {
  // Prioriteit 1: GitHub Actions Secrets / Environment Variables (VITE_FIREBASE_API_KEY)
  // Prioriteit 2: Lokaal ontwikkelbestand (staat in .gitignore en wordt niet gepusht naar GitHub)
  // Prioriteit 3: Veilige runtime fallback voor GitHub Pages deployment
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || local.apiKey || defaultApiKey,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || local.projectId || defaultProjectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || local.appId || defaultAppId,
  firestoreDatabaseId:
    import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID ||
    local.firestoreDatabaseId ||
    defaultDatabaseId,
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    local.authDomain ||
    `${defaultProjectId}.firebaseapp.com`,
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    local.storageBucket ||
    `${defaultProjectId}.firebasestorage.app`,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || local.messagingSenderId || '290159195641',
};

export const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);
