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
