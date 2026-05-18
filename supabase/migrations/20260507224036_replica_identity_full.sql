-- Postgres logical replication only includes the primary key in DELETE
-- payloads by default. The Supabase realtime gateway then evaluates filters
-- like `kitchen_id=eq.<id>` against that payload — and since `kitchen_id`
-- isn't there, the event is silently dropped. The visible symptom: a cook
-- who leaves the kitchen still appears in the host's cook list because the
-- DELETE never reaches the host's realtime subscription.
--
-- `replica identity full` makes Postgres include every column in DELETE
-- payloads, so filtered subscriptions on those tables receive DELETE events.
-- Same fix applies to any table where we filter realtime subscriptions on
-- a non-PK column and care about deletions.

alter table public.cooks         replica identity full;
alter table public.tasks         replica identity full;
alter table public.ingredients   replica identity full;
alter table public.recipes       replica identity full;
