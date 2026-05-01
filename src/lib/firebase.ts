import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Use Local Persistence for better compatibility across sessions
const initPersistence = async () => {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (err) {
    console.warn("Auth persistence failed:", err);
  }
};

initPersistence().catch(console.error);

export const googleProvider = new GoogleAuthProvider();
// Force selecting account to avoid some "invalid action" errors due to cached bad sessions
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export async function signIn() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("Firebase Auth Error:", error.code, error.message);
    
    // Provide user-friendly messages for specific technical errors
    if (error.code === 'auth/invalid-action-code') {
      throw new Error("A ação solicitada é inválida. Isso pode ocorrer se o link de autenticação expirou ou já foi usado.");
    }
    
    throw error;
  }
}
