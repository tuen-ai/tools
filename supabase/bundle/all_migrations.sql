-- ============================================================
-- Wedding Photo Platform — bundled migrations 0001 → 0010
-- Paste this whole file into Supabase SQL Editor → Run.
-- Generated: 2026-07-05 UTC
-- ============================================================


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 0001_init.sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 0002_storage.sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Private storage bucket for guest media. Reads and writes go through
-- service-role-minted signed URLs only; no public access, no RLS policies
-- on storage.objects needed.

insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 0003_realtime.sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Enable Postgres logical replication for the media table so admins can
-- subscribe to live INSERT / UPDATE events. RLS still applies on the
-- delivery side: clients only receive rows their SELECT policy permits.

alter publication supabase_realtime add table public.media;

-- REPLICA IDENTITY FULL ensures UPDATE events carry the previous row's
-- values too — useful for distinguishing soft-delete from a hide.
alter table public.media replica identity full;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 0004_deleted_at.sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Track when a media row was soft-deleted so a cron can hard-delete it
-- after a grace period (the manual cleanup button ignores this and
-- purges everything with status='deleted' immediately).

alter table public.media
  add column deleted_at timestamptz;

-- Backfill: any rows currently soft-deleted get "now" as their delete
-- timestamp. They'll become cron-eligible 7 days from this migration.
update public.media set deleted_at = now() where status = 'deleted';

create or replace function public.media_track_deleted_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'deleted' and old.status is distinct from 'deleted' then
    new.deleted_at = now();
  elsif new.status <> 'deleted' then
    new.deleted_at = null;
  end if;
  return new;
end;
$$;

create trigger media_set_deleted_at
before update on public.media
for each row execute function public.media_track_deleted_at();

create index media_deleted_at_idx on public.media (deleted_at)
  where deleted_at is not null;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 0005_messages.sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 0006_tables_and_extras.sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 0007_audio_messages.sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Audio guestbook: guests can record a 30-second voice message instead
-- of (or alongside) text. Audio is stored at events/<id>/audio/<msgId>.<ext>
-- in the same media bucket; messages.audio_path holds the storage key.

alter table public.messages
  add column audio_path text;

-- Relax the original body length constraint so audio-only messages
-- are valid. Existing rows have body non-null, so this is additive.
alter table public.messages
  drop constraint messages_body_length;

alter table public.messages
  alter column body drop not null;

alter table public.messages
  add constraint messages_has_content check (
    (body is not null and char_length(body) between 1 and 500)
    or audio_path is not null
  );

-- realtime publication already covers public.messages (migration 0005).

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 0008_challenges.sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Phase 9: photo challenges (scavenger-hunt prompts).
--   * challenges — host-defined prompts ("photo with the oldest guest")
--   * media.challenge_id — optional tag from an upload back to a prompt
--
-- Guests pick a challenge (optional) when uploading a batch; the couple
-- can see which prompt each photo answers. Mirrors the tables/table_id
-- pattern from 0006.

create table public.challenges (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  prompt      text not null,
  created_at  timestamptz not null default now(),
  constraint challenges_prompt_length check (
    char_length(prompt) between 1 and 120
  ),
  constraint challenges_event_prompt_unique unique (event_id, prompt)
);

create index challenges_event_idx on public.challenges (event_id);

alter table public.media
  add column challenge_id uuid references public.challenges(id) on delete set null;

create index media_event_challenge_idx on public.media (event_id, challenge_id)
  where challenge_id is not null;

alter table public.challenges enable row level security;

create policy "Admins can read challenges of their events"
on public.challenges for select
to authenticated
using (
  exists (
    select 1 from public.admin_event_access aea
    where aea.event_id = challenges.event_id and aea.user_id = auth.uid()
  )
);

create policy "Admins can manage challenges of their events"
on public.challenges for all
to authenticated
using (
  exists (
    select 1 from public.admin_event_access aea
    where aea.event_id = challenges.event_id and aea.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.admin_event_access aea
    where aea.event_id = challenges.event_id and aea.user_id = auth.uid()
  )
);

-- Guest pages render server-side with the service-role client, so anon
-- needs no direct SELECT here (same posture as tables).

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 0009_whoami.sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Diagnostic helper: lets the app ask the database "who do YOU think is
-- calling?" — auth.uid() as seen by PostgREST/RLS. Used by /api/whoami to
-- debug identity-propagation issues (auth API says logged-in, but RLS
-- rejects as anon). Returns only the caller's own uid; safe to expose.

create or replace function public.whoami()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

revoke all on function public.whoami() from public;
grant execute on function public.whoami() to anon, authenticated;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 0010_creator_can_read_own_event.sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Fix a chicken-and-egg RLS failure on event creation.
--
-- createEvent() does INSERT … RETURNING (PostgREST `.insert().select()`).
-- Postgres requires rows in RETURNING to also pass the SELECT policy, but
-- our SELECT policy depended solely on admin_event_access — which is only
-- populated by the AFTER INSERT trigger, i.e. AFTER the check runs. Every
-- event creation therefore failed with "new row violates row-level
-- security policy for table events" even for a correctly-authenticated
-- caller.
--
-- Fix: the creator can always read their own event. Semantically right on
-- its own, and it makes the RETURNING check pass at insert time.

drop policy "Admins can read their events" on public.events;

create policy "Admins can read their events"
on public.events for select
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1 from public.admin_event_access aea
    where aea.event_id = events.id and aea.user_id = auth.uid()
  )
);
