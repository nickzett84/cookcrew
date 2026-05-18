-- Phase 1b.1: anonymous kitchens + cooks.
-- No recipes, no tasks, no sous chef — those land in later phases.
-- Trust model: writes go through edge functions (service_role bypasses RLS).
-- Reads are open to anyone with a kitchen UUID. See DESIGN.md §12.

-- ─────────────────────────────────────────────────────────
-- kitchens
-- ─────────────────────────────────────────────────────────
create table public.kitchens (
  id            uuid        primary key default gen_random_uuid(),
  code          text        not null,
  name          text        not null default 'Your kitchen',
  status        text        not null default 'active'
                            check (status in ('active', 'ended')),
  main_cook_id  uuid,                              -- FK added below
  created_at    timestamptz not null default now(),
  ended_at      timestamptz
);

-- Only one *active* kitchen can hold a given code at a time.
-- Ended kitchens with the same code are fine (history is allowed).
create unique index kitchens_active_code_idx
  on public.kitchens (code)
  where status = 'active';

-- ─────────────────────────────────────────────────────────
-- cooks
-- ─────────────────────────────────────────────────────────
create table public.cooks (
  id            uuid        primary key default gen_random_uuid(),
  kitchen_id    uuid        not null references public.kitchens(id) on delete cascade,
  name          text        not null check (length(name) between 1 and 30),
  color         text        not null,             -- hex from cookPalette
  device_id     text        not null,
  joined_at     timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  unique (kitchen_id, device_id)                  -- one row per device per kitchen
);

create index cooks_kitchen_id_idx on public.cooks (kitchen_id);

-- Now that cooks exists, attach the host FK on kitchens.
alter table public.kitchens
  add constraint kitchens_main_cook_id_fkey
  foreign key (main_cook_id) references public.cooks(id) on delete set null;

-- ─────────────────────────────────────────────────────────
-- Realtime: app subscribes to cook list changes.
-- ─────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.kitchens;
alter publication supabase_realtime add table public.cooks;

-- ─────────────────────────────────────────────────────────
-- Row-Level Security
-- ─────────────────────────────────────────────────────────
alter table public.kitchens enable row level security;
alter table public.cooks    enable row level security;

-- SELECT is open: client needs to subscribe to realtime changes by kitchen_id.
-- No INSERT / UPDATE / DELETE policies = client cannot write.
-- All mutations go through edge functions using the service_role key,
-- which bypasses RLS.
create policy "anyone can select kitchens"
  on public.kitchens for select
  using (true);

create policy "anyone can select cooks"
  on public.cooks for select
  using (true);
