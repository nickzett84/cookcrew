-- Edge functions authenticate as service_role; without these grants,
-- table access fails with "permission denied" before RLS policies run.
-- This is required on Supabase projects using the new sb_secret_ key format.

grant all on public.kitchens to service_role;
grant all on public.cooks    to service_role;
