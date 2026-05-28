# Wedding Guest Photo Platform

A QR-code-driven wedding photo collection app. Guests scan a code at their
table, upload photos straight from a mobile browser (no app install), and the
couple sees them in a private admin gallery.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase: Postgres, Storage, Auth, Realtime
- Deploys to Vercel

## Phase status

- [x] Phase 1: architecture, schema, flows, folder structure
- [x] Phase 2: guest upload flow
- [x] Phase 3: admin dashboard
- [x] Phase 4: realtime gallery (admin-only)
- [ ] Phase 5: scaling + security hardening

## Running locally

```bash
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# and SUPABASE_SERVICE_ROLE_KEY from your Supabase project settings
npm install
npm run dev
```

Apply migrations against your Supabase project before first run:

```bash
# via the Supabase CLI:
supabase db push
# or paste supabase/migrations/0001_init.sql + 0002_storage.sql into
# the SQL editor for a hosted project
```

To test the guest flow you'll need at least one event row. Quick seed:

```sql
-- assuming auth.uid() returns a real user id when you're signed in via the dashboard
insert into events (slug, couple_names, welcome_message, created_by)
values ('test-wedding', 'Test & Wedding',
        'Share your favourite photos with us!',
        (select id from auth.users limit 1));
```

Then visit http://localhost:3000/e/test-wedding.

## Architectural decisions

### Uploads bypass Next.js
Guests upload directly to Supabase Storage via short-lived signed PUT URLs
minted by `/api/upload/sign`. Files never pass through Vercel functions.
After each PUT, the client calls `/api/media/finalize`, which HEADs the
storage object and inserts the `media` row — this closes the gap between
"client claims it uploaded" and "row exists."

### Gallery is private to the couple
Anonymous (`anon`) role has `INSERT` on `media` and `guests` only — no
`SELECT`. Guests never see other guests' photos. Realtime publication is
scoped to admin sessions.

### Guests are anonymous + fingerprinted
No accounts, no SMS. Each browser generates a UUID stored in localStorage
(`wgp.fingerprint`) and posts it as `client_fingerprint`. Optional
`display_name` is also kept in localStorage so the guest doesn't retype it
on a second visit. This is "soft identity" — a guest clearing storage
becomes a new row. That's acceptable; the abuse limit is per-fingerprint
plus a coarse IP rate limit at the edge.

### Storage is private
Single private bucket `media`. Read access only via admin-minted signed GET
URLs (5-min TTL). No public bucket needed.

### Soft delete for media
Admin "delete" sets `status = 'deleted'`; the row and storage object
survive for ~7 days so accidents are recoverable. A cron in Phase 5 hard-
deletes after the grace period.

### Event lookup uses a function, not direct SELECT
`get_event_by_slug(text)` is `SECURITY DEFINER`. Anonymous SELECT on
`events` is denied so anonymous users can't enumerate every wedding in
the database.

## Database

Four tables, all in `public`:

| Table | Purpose |
|-------|---------|
| `events` | One row per wedding; slug, welcome text, theme, upload kill-switch |
| `guests` | One row per (event, fingerprint); optional display name |
| `media`  | One row per uploaded photo; `status` enum for moderation |
| `admin_event_access` | M:N between `auth.users` and `events`; roles: owner/editor |

Schema is in `supabase/migrations/0001_init.sql`. RLS is on for all four.

### Regenerating TypeScript types

```bash
# After any migration:
npx supabase gen types typescript --project-id <id> > src/types/database.ts
```

(This will be wired into a `scripts/gen-types.sh` and `npm run gen:types` in
Phase 2.)

## URL shape

- Guest: `https://<domain>/e/<slug>` (slug is `^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$`)
- Admin: `https://<domain>/admin` and `/admin/[eventId]`

## Supabase clients in `src/lib/supabase/`

- `server.ts` — anon-keyed, cookie-bound, RLS applies. Use from RSC and
  route handlers when the caller's permissions should be enforced.
- `admin.ts` — service-role, **bypasses RLS**. Only import from
  `route.ts` files. An ESLint rule to enforce this is on the Phase 5
  hardening list.
- `browser.ts` — used by the admin media grid to subscribe to Realtime.
  Its session JWT comes from the auth cookie set by the server, so RLS
  evaluates against the signed-in admin and "Admins can read media of
  their events" gates which rows the channel can deliver.

## Upload contract

`POST /api/upload/sign` is one round-trip per batch (up to 10 files). It
upserts the guest row, enforces `max_uploads_per_guest`, and returns N
signed PUT URLs + media IDs. The client PUTs files directly to Supabase
Storage (max 3 concurrent on mobile) with XHR progress, then POSTs each
to `/api/media/finalize`. Finalize HEADs the storage object and inserts
the `media` row — never trust the client about what was actually stored.

Shared limits live in `src/lib/upload/constants.ts`:
25 MB/file, 10 files/request, JPEG/PNG/WebP/HEIC/HEIF.

## Admin surfaces (Phase 3)

| Route | Purpose |
|-------|---------|
| `/admin/login` | Email + password sign-in & sign-up (one form, two modes) |
| `/admin` | Event list for the current user |
| `/admin/new` | Create a new event |
| `/admin/[eventId]` | Media grid with hide/delete/restore + download |
| `/admin/[eventId]/settings` | Edit couple's names, welcome msg, upload kill-switch |
| `/admin/[eventId]/qr` | Printable QR with `@media print` styles |

**Route groups in use:**
- `(auth)/admin/login` — public, renders without admin chrome.
- `(admin)/admin/*` — everything else; layout enforces `requireSession()`.

**Auth is enforced in two layers:**
1. RSC pages call `requireSession()` / `requireEventAdmin()` (in
   `src/lib/auth/require-admin.ts`), which `redirect()` on failure.
2. Server actions and route handlers call `assertEventAdmin()`, which
   throws `AuthorizationError` and gets mapped to 401/403 JSON.

RLS is still in place — the helpers are defence in depth, not the only
gate.

**Sign-up is currently open to anyone with the URL.** Before launch, gate
this via invite codes or an email allowlist. (Note in `actions.ts`.)

## Realtime (Phase 4)

`0003_realtime.sql` adds `public.media` to the `supabase_realtime`
publication and sets `REPLICA IDENTITY FULL` so UPDATE events carry the
previous row too. The admin media grid subscribes via
`createSupabaseBrowserClient()` to a channel filtered by
`event_id=eq.<id>`. INSERT events prepend the new tile (with a "New"
ribbon for 4s); UPDATE events overwrite the row in state so a hide /
delete from another admin's tab is reflected instantly.

A small status dot in the grid header shows connecting / live /
disconnected — handy when running over flaky conference Wi-Fi.

Bundle impact: the admin event page grew from ~1.7 KB to ~80 KB
(`@supabase/realtime-js`). Acceptable for an admin-only surface; the
guest upload page is untouched at 3.19 KB.

## Things deliberately deferred

- Video support (photos only for MVP — schema leaves room via `mime_type`)
- Per-table QR tagging (`guests` could grow a `table_id` later)
- Client-side compression (couples want originals for prints)
- EXIF stripping on storage (keep originals for the couple; serve stripped
  variants via image transform if/when media leaves the admin surface)
- i18n
- Multi-event SaaS billing / tenant isolation
- Hard-delete cron for soft-deleted media
