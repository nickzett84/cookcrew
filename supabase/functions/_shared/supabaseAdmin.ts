import { createClient } from 'jsr:@supabase/supabase-js@2';

// Edge functions run with the service-role key as a managed secret.
// This client BYPASSES Row-Level Security — never use it from the app bundle.

export function getAdminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
