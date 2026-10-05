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

// Check custom config in localStorage (Bring Your Own Firebase Project)
let storedCustomConfig: any = null;
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const raw = window.localStorage.getItem('custom_firebase_config');
    if (raw) storedCustomConfig = JSON.parse(raw);
  }
} catch {
  // Ignored
}

// Support custom config > VITE_FIREBASE_* environment variables > firebase-applet-config.json
export const resolvedFirebaseConfig = {
  projectId:
    storedCustomConfig?.projectId ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID) ||
    firebaseConfig.projectId,
  appId:
    storedCustomConfig?.appId ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APP_ID) ||
    firebaseConfig.appId,
  apiKey:
    storedCustomConfig?.apiKey ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) ||
    firebaseConfig.apiKey,
  authDomain:
    storedCustomConfig?.authDomain ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN) ||
    firebaseConfig.authDomain,
  storageBucket:
    storedCustomConfig?.storageBucket ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET) ||
    firebaseConfig.storageBucket,
  messagingSenderId:
    storedCustomConfig?.messagingSenderId ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) ||
    firebaseConfig.messagingSenderId,
};

export const isUsingCustomFirebase = Boolean(storedCustomConfig?.projectId);
export const activeFirebaseProjectId = resolvedFirebaseConfig.projectId;

export const getCustomFirebaseConfig = () => storedCustomConfig;

export const saveCustomFirebaseConfig = (config: Record<string, string>) => {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem('custom_firebase_config', JSON.stringify(config));
    window.location.reload();
  }
};

export const clearCustomFirebaseConfig = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem('custom_firebase_config');
    window.location.reload();
  }
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
const USER_STORAGE_KEY = 'apex_google_user_profile';

// In-memory & session-persistent token management
let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Try to hydrate from localStorage/sessionStorage on load
try {
  if (typeof window !== 'undefined') {
    cachedAccessToken =
      window.sessionStorage.getItem(TOKEN_STORAGE_KEY) ||
      window.localStorage.getItem(TOKEN_STORAGE_KEY);
  }
} catch {
  // Ignored in SSR
}

export const setManualAccessToken = (token: string) => {
  cachedAccessToken = token;
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    }
  } catch {}
};

// Direct Google Identity Services (GIS) Sign-In (Bypasses Firebase domain restrictions!)
export const directGisSignIn = (): Promise<{ user: User; accessToken: string }> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !(window as any).google?.accounts?.oauth2) {
      reject(new Error('GIS_UNAVAILABLE'));
      return;
    }

    const clientId =
      (firebaseConfig as any).oAuthClientId ||
      '334167843799-ka7pfq56f9p40ei2e8kme1b332a4ek13.apps.googleusercontent.com';

    try {
      const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope:
          'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        callback: async (resp: any) => {
          if (resp.error) {
            reject(new Error(resp.error_description || resp.error));
            return;
          }
          if (!resp.access_token) {
            reject(new Error('Gagal mendapatkan token akses dari Google.'));
            return;
          }

          const accessToken = resp.access_token;
          cachedAccessToken = accessToken;
          try {
            window.sessionStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
            window.localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
          } catch {}

          // Fetch user profile from Google UserInfo
          let userObj: any = {
            displayName: 'Akun Google',
            email: '',
            photoURL: '',
            uid: 'gis-' + Date.now(),
          };

          try {
            const pRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (pRes.ok) {
              const profile = await pRes.json();
              userObj = {
                displayName: profile.name || profile.email?.split('@')[0] || 'Akun Google',
                email: profile.email || '',
                photoURL: profile.picture || '',
                uid: profile.sub || 'gis-' + Date.now(),
              };
            }
          } catch (e) {
            console.warn('Gagal memuat profil Google:', e);
          }

          try {
            window.sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userObj));
            window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userObj));
          } catch {}

          resolve({ user: userObj as User, accessToken });
        },
      });

      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch (err) {
      reject(err);
    }
  });
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (err?: any) => void
) => {
  // 1. Check for stored GIS user profile first
  if (typeof window !== 'undefined') {
    try {
      const storedProfile =
        window.sessionStorage.getItem(USER_STORAGE_KEY) ||
        window.localStorage.getItem(USER_STORAGE_KEY);
      const storedToken =
        window.sessionStorage.getItem(TOKEN_STORAGE_KEY) ||
        window.localStorage.getItem(TOKEN_STORAGE_KEY);

      if (storedProfile && storedToken) {
        const parsed = JSON.parse(storedProfile);
        cachedAccessToken = storedToken;
        if (onAuthSuccess) onAuthSuccess(parsed as User, storedToken);
        return () => {};
      }
    } catch {}

    // Check redirect result (if user was redirected on mobile)
    getRedirectResult(auth)
      .then(result => {
        if (result) {
          const credential = GoogleAuthProvider.credentialFromResult(result);
          if (credential?.accessToken) {
            cachedAccessToken = credential.accessToken;
            try {
              window.sessionStorage.setItem(TOKEN_STORAGE_KEY, credential.accessToken);
              window.localStorage.setItem(TOKEN_STORAGE_KEY, credential.accessToken);
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
          cachedAccessToken =
            window.sessionStorage.getItem(TOKEN_STORAGE_KEY) ||
            window.localStorage.getItem(TOKEN_STORAGE_KEY);
        } catch {}
      }

      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      // Check if we have GIS token
      const gisToken =
        typeof window !== 'undefined'
          ? window.sessionStorage.getItem(TOKEN_STORAGE_KEY) ||
            window.localStorage.getItem(TOKEN_STORAGE_KEY)
          : null;
      const gisUser =
        typeof window !== 'undefined'
          ? window.sessionStorage.getItem(USER_STORAGE_KEY) ||
            window.localStorage.getItem(USER_STORAGE_KEY)
          : null;

      if (gisToken && gisUser) {
        try {
          const parsed = JSON.parse(gisUser);
          cachedAccessToken = gisToken;
          if (onAuthSuccess) onAuthSuccess(parsed as User, gisToken);
          return;
        } catch {}
      }

      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (useRedirect = false): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;

    // Strategy 1: Try Direct Google Identity Services (GIS)
    // Works 100% on any domain (Cloud Run, Vercel, localhost) without Firebase domain restrictions!
    if (!useRedirect && typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
      try {
        const gisResult = await directGisSignIn();
        return gisResult;
      } catch (gisErr: any) {
        console.warn('GIS error, falling back to Firebase Auth:', gisErr);
        if (gisErr?.message?.includes('popup_closed') || gisErr?.message?.includes('access_denied')) {
          throw gisErr;
        }
      }
    }

    // Strategy 2: Firebase Auth Popup / Redirect
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
      window.localStorage.setItem(TOKEN_STORAGE_KEY, cachedAccessToken);
    } catch {}

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    const errorCode = error?.code || '';
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';

    console.error('Google Sign In Error:', errorCode, error);

    // Specific friendly handling for unauthorized domain on Vercel / Cloud Run
    if (errorCode === 'auth/unauthorized-domain') {
      const err = new Error(
        `DOMAIN_UNAUTHORIZED:${currentHost || 'run.app'}`
      );
      (err as any).code = 'auth/unauthorized-domain';
      (err as any).hostname = currentHost;
      (err as any).projectId = resolvedFirebaseConfig.projectId;
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
      cachedAccessToken =
        window.sessionStorage.getItem(TOKEN_STORAGE_KEY) ||
        window.localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {}
  }
  return cachedAccessToken;
};

export const logout = async (): Promise<void> => {
  try {
    await auth.signOut();
  } catch {}
  cachedAccessToken = null;
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      window.sessionStorage.removeItem(USER_STORAGE_KEY);
      window.localStorage.removeItem(USER_STORAGE_KEY);
    }
  } catch {}
};
