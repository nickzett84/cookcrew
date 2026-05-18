-- Phase 4: delegation. Track who assigned each task/ingredient so the
-- in-app banner can read "Florian gave you: chop the carrots". Schema-only
-- change — no policy or grant edits needed; assigned_by is set/cleared by
-- the assign-checkbox edge function via service_role.

alter table public.tasks
  add column assigned_by uuid references public.cooks(id) on delete set null;

alter table public.ingredients
  add column assigned_by uuid references public.cooks(id) on delete set null;
