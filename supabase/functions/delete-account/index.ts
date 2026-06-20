// POST /functions/v1/delete-account
// Auth: REQUIRED — the caller must send their Supabase Auth access token.
// Effect: permanently deletes the auth user. Their kitchens + cook rows are
//   UNLINKED (not deleted) automatically by the `on delete set null` FKs on
//   kitchens.owner_user_id / cooks.user_id — so any kitchen they hosted keeps
//   running for the other cooks. Full "erase all my data" semantics are a
//   Phase 11 concern (decision log 2026-06-20).
// Returns: { ok: true }

import { corsHeaders } from '../_shared/cors.ts';
import { json, badRequest, forbidden, serverError } from '../_shared/response.ts';
import { getAdminClient } from '../_shared/supabaseAdmin.ts';
import { getUserId } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return badRequest('Use POST');

  const userId = await getUserId(req);
  if (!userId) return forbidden('Sign in required');

  const { error } = await getAdminClient().auth.admin.deleteUser(userId);
  if (error) return serverError(error.message);

  return json({ ok: true });
});
