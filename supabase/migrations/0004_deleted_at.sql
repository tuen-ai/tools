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
