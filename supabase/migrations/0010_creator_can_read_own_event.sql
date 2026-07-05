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
