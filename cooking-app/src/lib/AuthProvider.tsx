import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { api } from './api';
import { AuthContext, AuthState } from './auth';

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
    // Implemented in the Apple/rebuild step (needs expo-apple-authentication):
    //   const credential = await AppleAuthentication.signInAsync({
    //     requestedScopes: [FULL_NAME, EMAIL],
    //   });
    //   await supabase.auth.signInWithIdToken({
    //     provider: 'apple',
    //     token: credential.identityToken!,
    //   });
    throw new Error('Sign in with Apple is not wired yet.');
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
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
      signOut,
      deleteAccount,
    }),
    [ready, session, signInWithApple, signOut, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
