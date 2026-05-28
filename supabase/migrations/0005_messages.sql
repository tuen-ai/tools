-- Guest messages: an optional short note submitted alongside an upload
-- batch. One row per submission; guests can post multiple times across
-- sessions. Read-only for the couple via the admin dashboard.

create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  guest_id    uuid references public.guests(id) on delete set null,
  body        text not null,
  created_at  timestamptz not null default now(),
  constraint messages_body_length check (
    char_length(body) between 1 and 500
  )
);

create index messages_event_created_idx
  on public.messages (event_id, created_at desc);

alter table public.messages enable row level security;

create policy "Anyone can post a message for open events"
on public.messages for insert
to anon, authenticated
with check (
  exists (
    select 1 from public.events e
    where e.id = messages.event_id and e.upload_enabled = true
  )
);

create policy "Admins can read messages of their events"
on public.messages for select
to authenticated
using (
  exists (
    select 1 from public.admin_event_access aea
    where aea.event_id = messages.event_id and aea.user_id = auth.uid()
  )
);

create policy "Admins can delete messages of their events"
on public.messages for delete
to authenticated
using (
  exists (
    select 1 from public.admin_event_access aea
    where aea.event_id = messages.event_id and aea.user_id = auth.uid()
  )
);

-- Realtime so the admin feed updates without a refresh.
alter publication supabase_realtime add table public.messages;
alter table public.messages replica identity full;
