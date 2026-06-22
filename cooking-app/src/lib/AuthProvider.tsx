import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  GoogleSignin,
  statusCodes,
  isErrorWithCode,
} from '@react-native-google-signin/google-signin';
import { supabase } from './supabase';
import { api } from './api';
import { AuthContext, AuthState } from './auth';
import { GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID } from './authConfig';

GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID,
  iosClientId: GOOGLE_IOS_CLIENT_ID,
});

// Holds the head chef's signed-in session. Guests never sign in, so for them
// this provider simply reports `session: null` and everything downstream falls
// back to the anonymous path.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Load any persisted session from the Keychain on launch...
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    // ...then keep it in sync (token refresh, sign-in, sign-out).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signInWithApple = useCallback(async () => {
    let credential: AppleAuthentication.AppleAuthenticationCredential;
    try {
      credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
    } catch (e) {
      // User tapped Cancel — not an error worth surfacing.
      if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return;
      throw e;
    }
    if (!credential.identityToken) throw new Error('Apple did not return an identity token.');
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) throw error;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    let idToken: string | null = null;
    try {
      const response = await GoogleSignin.signIn();
      if (response.type !== 'success') return; // cancelled
      idToken = response.data.idToken;
    } catch (e) {
      if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) return;
      throw e;
    }
    if (!idToken) throw new Error('Google did not return an ID token.');
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // Clear the native Google session too, so the next sign-in shows the
    // account picker. No-op / throws harmlessly if they signed in via Apple.
    try {
      await GoogleSignin.signOut();
    } catch {
      /* not a Google session */
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    // Server deletes the auth user (and unlinks their kitchens via FK); then we
    // drop the local session so the app returns to the signed-out state.
    await api.deleteAccount();
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      session,
      userId: session?.user.id ?? null,
      email: session?.user.email ?? null,
      signInWithApple,
      signInWithGoogle,
      signOut,
      deleteAccount,
    }),
    [ready, session, signInWithApple, signInWithGoogle, signOut, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
