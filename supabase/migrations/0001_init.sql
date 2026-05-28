-- Wedding guest photo platform — initial schema, RLS, and triggers.
--
-- Design notes:
--   * Guests are anonymous. Identity is a localStorage fingerprint, not auth.
--   * Anon role can INSERT into guests/media only for events with upload_enabled = true.
--   * Anon role cannot SELECT media or guests — the gallery is private to admins.
--   * Public event metadata is exposed via get_event_by_slug() to prevent enumeration.
--   * Media deletion is soft (status = 'deleted'); a later cron purges storage objects.

create extension if not exists "pgcrypto";

-- ============================================================
-- Enums
-- ============================================================

create type public.media_status as enum ('visible', 'hidden', 'deleted');
create type public.admin_role  as enum ('owner', 'editor');

-- ============================================================
-- Tables
-- ============================================================

create table public.events (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text not null unique,
  couple_names           text not null,
  event_date             date,
  welcome_message        text,
  cover_image_path       text,
  theme                  jsonb not null default '{}'::jsonb,
  upload_enabled         boolean not null default true,
  max_uploads_per_guest  int not null default 50 check (max_uploads_per_guest > 0),
  created_by             uuid not null references auth.users(id) on delete restrict,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint events_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$')
);

create table public.guests (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references public.events(id) on delete cascade,
  display_name        text,
  client_fingerprint  text not null,
  created_at          timestamptz not null default now(),
  constraint guests_fingerprint_unique unique (event_id, client_fingerprint)
);

create table public.media (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  guest_id      uuid references public.guests(id) on delete set null,
  storage_path  text not null unique,
  mime_type     text not null,
  size_bytes    bigint not null check (size_bytes > 0),
  width         int,
  height        int,
  taken_at      timestamptz,
  status        public.media_status not null default 'visible',
  created_at    timestamptz not null default now()
);

create index media_event_created_idx on public.media (event_id, created_at desc);
create index media_event_status_idx  on public.media (event_id, status);

create table public.admin_event_access (
  event_id    uuid not null references public.events(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        public.admin_role not null default 'editor',
  created_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- ============================================================
-- Triggers
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

-- When an admin creates an event, automatically grant them owner access.
-- SECURITY DEFINER so the trigger can write to admin_event_access regardless of RLS.
create or replace function public.grant_event_owner_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_event_access (event_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

create trigger events_grant_owner
after insert on public.events
for each row execute function public.grant_event_owner_access();

-- ============================================================
-- Public read function (prevents anonymous enumeration of events)
-- ============================================================

create or replace function public.get_event_by_slug(p_slug text)
returns table (
  id                     uuid,
  slug                   text,
  couple_names           text,
  event_date             date,
  welcome_message        text,
  cover_image_path       text,
  theme                  jsonb,
  upload_enabled         boolean,
  max_uploads_per_guest  int
)
language sql
stable
security definer
set search_path = public
as $$
  select id, slug, couple_names, event_date, welcome_message, cover_image_path,
         theme, upload_enabled, max_uploads_per_guest
  from public.events
  where slug = p_slug;
$$;

revoke all on function public.get_event_by_slug(text) from public;
grant execute on function public.get_event_by_slug(text) to anon, authenticated;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.events              enable row level security;
alter table public.guests              enable row level security;
alter table public.media               enable row level security;
alter table public.admin_event_access  enable row level security;

-- ---------- events ----------

create policy "Admins can read their events"
on public.events for select
to authenticated
using (
  exists (
    select 1 from public.admin_event_access aea
    where aea.event_id = events.id and aea.user_id = auth.uid()
  )
);

create policy "Authenticated users can create events"
on public.events for insert
to authenticated
with check (created_by = auth.uid());

create policy "Admins can update their events"
on public.events for update
to authenticated
using (
  exists (
    select 1 from public.admin_event_access aea
    where aea.event_id = events.id and aea.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.admin_event_access aea
    where aea.event_id = events.id and aea.user_id = auth.uid()
  )
);

create policy "Owners can delete their events"
on public.events for delete
to authenticated
using (
  exists (
    select 1 from public.admin_event_access aea
    where aea.event_id = events.id
      and aea.user_id = auth.uid()
      and aea.role = 'owner'
  )
);

-- ---------- guests ----------

create policy "Anyone can register as guest for open events"
on public.guests for insert
to anon, authenticated
with check (
  exists (
    select 1 from public.events e
    where e.id = guests.event_id and e.upload_enabled = true
  )
);

create policy "Admins can read guests of their events"
on public.guests for select
to authenticated
using (
  exists (
    select 1 from public.admin_event_access aea
    where aea.event_id = guests.event_id and aea.user_id = auth.uid()
  )
);

-- ---------- media ----------

create policy "Anyone can upload media to open events"
on public.media for insert
to anon, authenticated
with check (
  status = 'visible'
  and exists (
    select 1 from public.events e
    where e.id = media.event_id and e.upload_enabled = true
  )
);

create policy "Admins can read media of their events"
on public.media for select
to authenticated
using (
  exists (
    select 1 from public.admin_event_access aea
    where aea.event_id = media.event_id and aea.user_id = auth.uid()
  )
);

create policy "Admins can update media of their events"
on public.media for update
to authenticated
using (
  exists (
    select 1 from public.admin_event_access aea
    where aea.event_id = media.event_id and aea.user_id = auth.uid()
  )
);
-- No DELETE policy: admins soft-delete via status='deleted'. Service role purges.

-- ---------- admin_event_access ----------

create policy "Admins can see their own access rows"
on public.admin_event_access for select
to authenticated
using (user_id = auth.uid());

create policy "Owners can grant access to their events"
on public.admin_event_access for insert
to authenticated
with check (
  exists (
    select 1 from public.admin_event_access aea
    where aea.event_id = admin_event_access.event_id
      and aea.user_id = auth.uid()
      and aea.role = 'owner'
  )
);

-- Owners can revoke anyone except themselves (prevents orphaning an event).
create policy "Owners can revoke access from others"
on public.admin_event_access for delete
to authenticated
using (
  user_id <> auth.uid()
  and exists (
    select 1 from public.admin_event_access aea
    where aea.event_id = admin_event_access.event_id
      and aea.user_id = auth.uid()
      and aea.role = 'owner'
  )
);
