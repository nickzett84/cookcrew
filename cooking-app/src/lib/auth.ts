import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';

export type AuthState = {
  // false until the persisted session has been loaded from the Keychain.
  ready: boolean;
  session: Session | null;
  userId: string | null;
  email: string | null;

  // Sign-in methods resolve on success, resolve silently if the user cancels,
  // and throw on a real failure.
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  // Permanently deletes the account server-side, then clears the local session.
  deleteAccount: () => Promise<void>;
};

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
