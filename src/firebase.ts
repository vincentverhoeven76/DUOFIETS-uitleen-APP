import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { doc, getFirestore, onSnapshot, setDoc, type Firestore } from 'firebase/firestore';
import { firebaseConfig, hasFirebaseConfig } from './config';
import type { DuofietsStatus } from './types';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

if (hasFirebaseConfig) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    db = firebaseConfig.firestoreDatabaseId
      ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
      : getFirestore(app);
  } catch (err) {
    console.warn('Firebase initialisatie kon niet worden voltooid:', err);
  }
}

/**
 * Luistert realtime naar statuswijzigingen in Firestore.
 * Als Firebase niet geconfigureerd is (bijv. in een public test repository),
 * wordt netjes de onError callback aangeroepen zodat de app op localStorage draait.
 */
export function subscribeToDuofietsStatus(
  onUpdate: (status: DuofietsStatus) => void,
  onError?: (err: unknown) => void
): () => void {
  if (!db) {
    if (onError) onError(new Error('Firebase niet geconfigureerd'));
    return () => {};
  }

  const statusDocRef = doc(db, 'duofiets', 'status');

  return onSnapshot(
    statusDocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const raw = snapshot.data();
        const data: DuofietsStatus = {
          isAvailable: Boolean(raw.isAvailable),
          expectedReturnTime: raw.expectedReturnTime || undefined,
          borrowedAt: raw.borrowedAt || undefined,
          updatedAt: raw.updatedAt || new Date().toISOString(),
        };
        onUpdate(data);
      } else {
        const initialStatus: DuofietsStatus = {
          isAvailable: true,
          updatedAt: new Date().toISOString(),
        };
        setDoc(statusDocRef, initialStatus).catch(console.error);
        onUpdate(initialStatus);
      }
    },
    (err) => {
      console.warn('Firestore live listener fout:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Werkt de status bij in de centrale database zodat iedereen het direct ziet.
 * Voorkomt 'undefined' waarden die Firestore blokkeert.
 */
export async function saveDuofietsStatusToFirebase(status: DuofietsStatus): Promise<void> {
  if (!db) {
    throw new Error('Geen centrale database verbinding');
  }

  const statusDocRef = doc(db, 'duofiets', 'status');
  const cleanPayload: Record<string, string | boolean> = {
    isAvailable: Boolean(status.isAvailable),
    updatedAt: status.updatedAt || new Date().toISOString(),
  };

  if (status.expectedReturnTime) {
    cleanPayload.expectedReturnTime = status.expectedReturnTime;
  }
  if (status.borrowedAt) {
    cleanPayload.borrowedAt = status.borrowedAt;
  }

  await setDoc(statusDocRef, cleanPayload);
}

export { hasFirebaseConfig };
