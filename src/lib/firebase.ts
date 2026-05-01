import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Handle persistence gracefully for iframe environments
// We try browserSessionPersistence which is usually more reliable in restrictive environments
const initPersistence = async () => {
  try {
    await setPersistence(auth, browserSessionPersistence);
    console.log("Auth persistence set to session");
  } catch (err) {
    console.warn("Auth persistence failed, falling back to memory:", err);
  }
};

// Only try initializing persistence, but don't block
initPersistence().catch(console.error);

export const googleProvider = new GoogleAuthProvider();

export async function signIn() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in:", error);
    throw error;
  }
}
