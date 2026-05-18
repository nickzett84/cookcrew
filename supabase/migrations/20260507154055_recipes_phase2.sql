-- Phase 2: recipe import + parse + review.
-- Adds recipes / recipe_sections / tasks / ingredients tables and the
-- recipe-uploads Storage bucket. Tasks and ingredients carry the assignment
-- and completion columns used in Phase 3 (delegation + check-offs).

-- ─────────────────────────────────────────────────────────
-- recipes
-- ─────────────────────────────────────────────────────────
create table public.recipes (
  id            uuid        primary key default gen_random_uuid(),
  kitchen_id    uuid        not null references public.kitchens(id) on delete cascade,
  title         text        not null default '',
  source_path   text,                                -- path inside recipe-uploads bucket
  source_type   text        check (source_type in ('photo', 'pdf', 'manual')),
  status        text        not null default 'parsing'
                            check (status in ('parsing', 'review', 'active', 'failed')),
  parse_error   text,
  parsed_at     timestamptz,
  created_at    timestamptz not null default now()
);

create index recipes_kitchen_id_idx on public.recipes (kitchen_id);

-- ─────────────────────────────────────────────────────────
-- recipe_sections
-- ─────────────────────────────────────────────────────────
create table public.recipe_sections (
  id            uuid        primary key default gen_random_uuid(),
  recipe_id     uuid        not null references public.recipes(id) on delete cascade,
  order_index   int         not null,
  title         text        not null
);

create index recipe_sections_recipe_id_idx on public.recipe_sections (recipe_id);

-- ─────────────────────────────────────────────────────────
-- tasks (cooking steps inside a section)
-- ─────────────────────────────────────────────────────────
create table public.tasks (
  id            uuid        primary key default gen_random_uuid(),
  recipe_id     uuid        not null references public.recipes(id) on delete cascade,
  section_id    uuid        not null references public.recipe_sections(id) on delete cascade,
  order_index   int         not null,
  description   text        not null,
  assigned_to   uuid        references public.cooks(id) on delete set null,
  completed_at  timestamptz,
  completed_by  uuid        references public.cooks(id) on delete set null
);

create index tasks_recipe_id_idx on public.tasks (recipe_id);
create index tasks_section_id_idx on public.tasks (section_id);

-- ─────────────────────────────────────────────────────────
-- ingredients (shopping list)
-- ─────────────────────────────────────────────────────────
create table public.ingredients (
  id            uuid        primary key default gen_random_uuid(),
  recipe_id     uuid        not null references public.recipes(id) on delete cascade,
  order_index   int         not null,
  name          text        not null,
  quantity      text,
  assigned_to   uuid        references public.cooks(id) on delete set null,
  checked_at    timestamptz,
  checked_by    uuid        references public.cooks(id) on delete set null
);

create index ingredients_recipe_id_idx on public.ingredients (recipe_id);

-- ─────────────────────────────────────────────────────────
-- Realtime
-- ─────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.recipes;
alter publication supabase_realtime add table public.recipe_sections;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.ingredients;

-- ─────────────────────────────────────────────────────────
-- RLS — same v1 trust model as kitchens/cooks (DESIGN.md §12)
-- Reads are open; all writes go through edge functions.
-- ─────────────────────────────────────────────────────────
alter table public.recipes enable row level security;
alter table public.recipe_sections enable row level security;
alter table public.tasks enable row level security;
alter table public.ingredients enable row level security;

create policy "anyone can select recipes"
  on public.recipes for select using (true);
create policy "anyone can select recipe_sections"
  on public.recipe_sections for select using (true);
create policy "anyone can select tasks"
  on public.tasks for select using (true);
create policy "anyone can select ingredients"
  on public.ingredients for select using (true);

-- Role-level grants (anon + service_role both required, see Phase 1b lessons)
grant select on public.recipes to anon, authenticated;
grant select on public.recipe_sections to anon, authenticated;
grant select on public.tasks to anon, authenticated;
grant select on public.ingredients to anon, authenticated;

grant all on public.recipes         to service_role;
grant all on public.recipe_sections to service_role;
grant all on public.tasks           to service_role;
grant all on public.ingredients     to service_role;

-- ─────────────────────────────────────────────────────────
-- Storage bucket: recipe-uploads
-- Public bucket. Path convention: <kitchen_id>/<random>.<ext>.
-- Same v1 trust model — knowing the kitchen UUID = membership.
-- ─────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('recipe-uploads', 'recipe-uploads', true)
on conflict (id) do nothing;

create policy "anyone can upload to recipe-uploads"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'recipe-uploads');

create policy "anyone can read recipe-uploads"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'recipe-uploads');
