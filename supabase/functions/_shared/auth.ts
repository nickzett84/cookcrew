import { getAdminClient } from './supabaseAdmin.ts';

// Returns the authenticated user's id if the request carries a valid Supabase
// Auth access token in the Authorization header, else null.
//
// Phase 8 trust model: only the head chef signs in. Guest (anonymous) calls
// send no Authorization header at all, so this returns null and the caller
// falls back to the anonymous path. Verification goes through the admin client
// (admin.auth.getUser validates the JWT signature + expiry server-side) so a
// forged or expired token is rejected — never trust the token's claims raw.
export async function getUserId(req: Request): Promise<string | null> {
  const header = req.headers.get('Authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const { data, error } = await getAdminClient().auth.getUser(match[1]);
  if (error || !data.user) return null;
  return data.user.id;
}
