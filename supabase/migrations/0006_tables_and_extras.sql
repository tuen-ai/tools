-- Phase 7/8 extensions:
--   * tables — per-table grouping so guests can be filtered by where they sat
--   * media.table_id — optional join from media back to a table
--   * (cover image uses existing events.cover_image_path — no schema change)
--   * (slideshow is read-via-slug; no new auth surface needed)

create table public.tables (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  label       text not null,
  created_at  timestamptz not null default now(),
  constraint tables_label_length check (
    char_length(label) between 1 and 64
  ),
  constraint tables_event_label_unique unique (event_id, label)
);

create index tables_event_idx on public.tables (event_id);

alter table public.media
  add column table_id uuid references public.tables(id) on delete set null;

create index media_event_table_idx on public.media (event_id, table_id)
  where table_id is not null;

alter table public.tables enable row level security;

create policy "Admins can read tables of their events"
on public.tables for select
to authenticated
using (
  exists (
    select 1 from public.admin_event_access aea
    where aea.event_id = tables.event_id and aea.user_id = auth.uid()
  )
);

create policy "Admins can manage tables of their events"
on public.tables for all
to authenticated
using (
  exists (
    select 1 from public.admin_event_access aea
    where aea.event_id = tables.event_id and aea.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.admin_event_access aea
    where aea.event_id = tables.event_id and aea.user_id = auth.uid()
  )
);

-- Look up a table by slug + label without exposing the events table to anon.
create or replace function public.get_table_by_slug_label(
  p_slug text,
  p_label text
)
returns table (id uuid, event_id uuid, label text)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.event_id, t.label
  from public.tables t
  join public.events e on e.id = t.event_id
  where e.slug = p_slug and t.label = p_label;
$$;

revoke all on function public.get_table_by_slug_label(text, text) from public;
grant execute on function public.get_table_by_slug_label(text, text) to anon, authenticated;
