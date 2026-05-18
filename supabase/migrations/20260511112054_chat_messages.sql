-- Phase 5: Ask Claude. Shared chat thread per kitchen — every cook sees
-- every question + answer. Same trust model as the rest of v1 — open SELECT,
-- writes via edge function (service_role).

create table public.chat_messages (
  id              uuid        primary key default gen_random_uuid(),
  kitchen_id      uuid        not null references public.kitchens(id) on delete cascade,
  cook_id         uuid        references public.cooks(id) on delete set null,
  role            text        not null check (role in ('user', 'assistant')),
  content         text        not null,
  context_task_id uuid        references public.tasks(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index chat_messages_kitchen_id_idx on public.chat_messages (kitchen_id, created_at);

-- Include the full row on DELETE so realtime kitchen_id filter doesn't drop events.
alter table public.chat_messages replica identity full;

alter publication supabase_realtime add table public.chat_messages;

alter table public.chat_messages enable row level security;

create policy "anyone can select chat_messages"
  on public.chat_messages for select using (true);

grant select on public.chat_messages to anon, authenticated;
grant all    on public.chat_messages to service_role;
