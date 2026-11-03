import { initializeApp } from 'firebase/app';
import { doc, getFirestore, onSnapshot, setDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type { DuofietsStatus } from './types';

// Initialiseer Firebase met de geprovisioneerde configuratie
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const STATUS_DOC_REF = doc(db, 'duofiets', 'status');

/**
 * Luistert realtime naar statuswijzigingen in Firestore.
 * Zodra iemand op zijn telefoon de status wijzigt, krijgen alle geopende
 * apparaten wereldwijd direct de update binnen.
 */
export function subscribeToDuofietsStatus(
  onUpdate: (status: DuofietsStatus) => void,
  onError?: (err: unknown) => void
) {
  return onSnapshot(
    STATUS_DOC_REF,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as DuofietsStatus;
        onUpdate(data);
      } else {
        // Document bestaat nog niet in Firestore; initialiseer op 'aanwezig'
        const initialStatus: DuofietsStatus = {
          isAvailable: true,
          updatedAt: new Date().toISOString(),
        };
        setDoc(STATUS_DOC_REF, initialStatus).catch(console.error);
        onUpdate(initialStatus);
      }
    },
    (err) => {
      console.warn('Firestore live listener error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Werkt de status bij in de centrale database zodat iedereen het direct ziet.
 */
export async function saveDuofietsStatusToFirebase(status: DuofietsStatus): Promise<void> {
  await setDoc(STATUS_DOC_REF, status);
}
