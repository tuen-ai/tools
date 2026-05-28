-- Enable Postgres logical replication for the media table so admins can
-- subscribe to live INSERT / UPDATE events. RLS still applies on the
-- delivery side: clients only receive rows their SELECT policy permits.

alter publication supabase_realtime add table public.media;

-- REPLICA IDENTITY FULL ensures UPDATE events carry the previous row's
-- values too — useful for distinguishing soft-delete from a hide.
alter table public.media replica identity full;
