-- Phase 6.C: host can rename/add/delete sections during cooking.
-- The recipe channel's section subscription filters by `recipe_id=eq.<id>`,
-- so DELETE events need `recipe_id` in the payload. Without
-- `replica identity full` Postgres only sends the PK on DELETE and the
-- filter would silently drop the event — see the parallel fix in
-- 20260507224036_replica_identity_full.sql for cooks/tasks/ingredients/recipes.

alter table public.recipe_sections replica identity full;
