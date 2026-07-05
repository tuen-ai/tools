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
