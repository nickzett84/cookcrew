-- RLS policies don't grant role-level access; the anon and authenticated
-- roles still need an explicit GRANT to read these tables. Without this,
-- the REST API returns "permission denied" before RLS policies even run.

grant select on public.kitchens to anon, authenticated;
grant select on public.cooks    to anon, authenticated;
