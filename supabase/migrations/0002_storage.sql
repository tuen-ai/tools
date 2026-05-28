-- Private storage bucket for guest media. Reads and writes go through
-- service-role-minted signed URLs only; no public access, no RLS policies
-- on storage.objects needed.

insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;
