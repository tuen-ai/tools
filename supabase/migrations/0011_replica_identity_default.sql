-- Privacy fix: stop broadcasting full row bodies on realtime DELETE.
--
-- 0003/0005 set REPLICA IDENTITY FULL on media + messages "so UPDATE
-- events carry the previous row too". But Supabase Realtime cannot apply
-- RLS or the channel's event_id filter to DELETE events (the row is gone
-- at check time), so with FULL the entire deleted row — including guest
-- MESSAGE BODIES — is delivered to every subscriber holding the public
-- anon key, across all events.
--
-- Neither client handler needs the old row: media-grid reads only
-- payload.new (INSERT/UPDATE); messages-panel reads payload.new on INSERT
-- and only payload.old.id on DELETE. Reverting to the default replica
-- identity (primary key) keeps both working while DELETE/UPDATE broadcasts
-- carry only the id — no body, no storage path.

alter table public.messages replica identity default;
alter table public.media replica identity default;
