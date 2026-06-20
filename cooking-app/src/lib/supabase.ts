import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { secureStoreAdapter } from './secureStoreAdapter';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Check cooking-app/.env.local — restart the dev server after editing.',
  );
}

// Phase 8: auth is enabled for the head chef (Sign in with Apple). The session
// persists in the iOS Keychain via secureStoreAdapter and auto-refreshes.
// Guests never sign in, so their client simply holds no session — the anon key
// still drives their realtime reads exactly as before.
export const supabase = createClient(url, key, {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const SUPABASE_URL = url;
