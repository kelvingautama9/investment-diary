import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Support VITE_FIREBASE_* environment variables for Vercel / GitHub Pages custom deployments
const resolvedFirebaseConfig = {
  projectId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID) || firebaseConfig.projectId,
  appId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APP_ID) || firebaseConfig.appId,
  apiKey: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) || firebaseConfig.apiKey,
  authDomain: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN) || firebaseConfig.authDomain,
  storageBucket: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET) || firebaseConfig.storageBucket,
  messagingSenderId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) || firebaseConfig.messagingSenderId,
};

// Initialize Firebase App singleton
const app = getApps().length > 0 ? getApp() : initializeApp(resolvedFirebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Add required Google Workspace scopes for Sheets and Drive
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

// Set custom parameters to force account selection and consent
provider.setCustomParameters({
  prompt: 'select_account',
});

const TOKEN_STORAGE_KEY = 'apex_google_access_token';

// In-memory & session-persistent token management
let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Try to hydrate from sessionStorage on load
try {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    cachedAccessToken = window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
  }
} catch {
  // Ignored in SSR
}

export const setManualAccessToken = (token: string) => {
  cachedAccessToken = token;
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    }
  } catch {}
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (err?: any) => void
) => {
  // Check redirect result first (if user was redirected on mobile/unsupported popup)
  if (typeof window !== 'undefined') {
    getRedirectResult(auth)
      .then(result => {
        if (result) {
          const credential = GoogleAuthProvider.credentialFromResult(result);
          if (credential?.accessToken) {
            cachedAccessToken = credential.accessToken;
            try {
              window.sessionStorage.setItem(TOKEN_STORAGE_KEY, credential.accessToken);
            } catch {}
            if (onAuthSuccess) onAuthSuccess(result.user, credential.accessToken);
          }
        }
      })
      .catch(err => {
        console.warn('[Firebase Auth] Redirect result error:', err);
      });
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (!cachedAccessToken) {
        try {
          cachedAccessToken = window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
        } catch {}
      }

      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      try {
        window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      } catch {}
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (useRedirect = false): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;

    if (useRedirect) {
      await signInWithRedirect(auth, provider);
      return null;
    }

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan token akses dari Google.');
    }

    cachedAccessToken = credential.accessToken;
    try {
      window.sessionStorage.setItem(TOKEN_STORAGE_KEY, cachedAccessToken);
    } catch {}

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    const errorCode = error?.code || '';
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';

    console.error('Google Sign In Error:', errorCode, error);

    // Specific friendly handling for unauthorized domain on Vercel / GitHub Pages
    if (errorCode === 'auth/unauthorized-domain') {
      const err = new Error(
        `DOMAIN_UNAUTHORIZED:${currentHost || 'vercel.app'}`
      );
      (err as any).code = 'auth/unauthorized-domain';
      (err as any).hostname = currentHost;
      throw err;
    }

    // Popup blocked on mobile or browser privacy settings -> fallback to redirect
    if (errorCode === 'auth/popup-blocked' || errorCode === 'auth/cancelled-popup-request') {
      console.warn('Popup blocked, attempting redirect sign-in...');
      await signInWithRedirect(auth, provider);
      return null;
    }

    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken && typeof window !== 'undefined') {
    try {
      cachedAccessToken = window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {}
  }
  return cachedAccessToken;
};

export const logout = async (): Promise<void> => {
  await auth.signOut();
  cachedAccessToken = null;
  try {
    window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {}
};
