-- Phase 8: accounts. The head chef gets a Supabase Auth identity (Sign in with
-- Apple); guests still join anonymously by code with a name only.
--
-- This migration is deliberately ADDITIVE + NULLABLE so it doesn't disturb the
-- existing anonymous flow: every current row keeps user_id / owner_user_id null,
-- and create-kitchen only stamps them once a host is signed in.
--
-- No new RLS policies here. Reads stay open ("anyone can select" — guests have
-- no JWT and need anon realtime reads), and all writes still flow through the
-- service_role edge functions. Owner-scoped policies for direct client queries
-- ("show me MY past kitchens") land with recipe history in Phase 11, which is
-- the first feature that reads these columns from the client.

-- The head chef's account link. Null for guests, set for the signed-in host.
-- on delete set null: if the auth user is deleted, the cook row survives
-- anonymized rather than cascading away an in-progress kitchen.
alter table public.cooks
  add column user_id uuid references auth.users(id) on delete set null;

-- Durable owner of the kitchen — the account that created it. This is what
-- "my kitchens" / history keys off in Phase 11. Distinct from main_cook_id
-- (which points at a cooks row that only lives as long as the session).
alter table public.kitchens
  add column owner_user_id uuid references auth.users(id) on delete set null;

create index cooks_user_id_idx on public.cooks (user_id);
create index kitchens_owner_user_id_idx on public.kitchens (owner_user_id);
