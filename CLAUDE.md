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
- [x] Phase 5: signup gate, rate limit, storage cleanup, server-only
      guards, upload retry, OG meta, scheduled hard-delete cron
- [x] Phase 6: i18n (en / 繁中), custom theme color, guest messages,
      ZIP album export
- [x] Phase 7: live slideshow (`/e/[slug]/show`), video upload (30s cap),
      cover image, animations + confetti
- [x] Phase 8: per-table QR codes (`/e/[slug]?table=X`),
      tables admin (`/admin/[eventId]/tables`)
- [x] Phase 9 (adoption levers, from 2025-26 market research): photo
      challenges (`challenges` table + `media.challenge_id`, admin CRUD at
      `/admin/[eventId]/challenges`, guest chips), live photo wall
      (`/e/[slug]/show?layout=wall` masonry mode), guest "my uploads"
      reassurance strip (`POST /api/media/mine`), thank-you-card QR insert
      (`/admin/[eventId]/qr?variant=thankyou`, 4-up A4), HEIC accept-attr
      fix (iOS transcodes to JPEG when HEIC absent from `accept`)

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

**Exception — the slideshow (Phase 7).** `/api/event/[slug]/slideshow`
and `/e/[slug]/show` use the service-role client and deliberately bypass
this RLS invariant: anyone holding the (publicly printed/forwarded) slug
can poll for 30-min signed download URLs of every *visible* photo/video.
This is an intentional trade-off for a frictionless venue projector
(slug = bearer token). If stronger privacy is ever required, gate these
two surfaces behind an admin-rotatable `events.show_token` column instead
of the slug.

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

Seven tables, all in `public`:

| Table | Purpose |
|-------|---------|
| `events` | One row per wedding; slug, welcome text, theme, upload kill-switch |
| `guests` | One row per (event, fingerprint); optional display name |
| `media`  | One row per uploaded photo/video; `status` enum for moderation; optional `table_id` / `challenge_id` tags |
| `admin_event_access` | M:N between `auth.users` and `events`; roles: owner/editor |
| `messages` | Guest notes (text and/or `audio_path` voice clips) |
| `tables` | Per-table QR labels (0006) |
| `challenges` | Photo-challenge prompts (0008) |

Base schema is in `supabase/migrations/0001_init.sql`; later tables in
0005–0008. `supabase/bundle/all_migrations.sql` concatenates everything for
a one-shot SQL-editor paste. RLS is on for all tables.

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

### Signup gating

`ADMIN_SIGNUP_INVITE_CODE` (server env, optional). When set, the sign-up
form requires this exact code. When unset, signups are **closed** — add
admins via the Supabase dashboard. The check uses constant-time compare
to dodge timing side-channels. See `src/lib/auth/actions.ts`.

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

## Hardening (Phase 5)

### server-only guards

`src/lib/supabase/admin.ts` (service-role) and `src/lib/supabase/server.ts`
both `import "server-only"`. Any client component that transitively imports
either fails the Next.js build with a clear error — this is stronger than
an ESLint warning because it can't be bypassed by ignoring lint output.

### Rate limit

`src/lib/rate-limit.ts` implements a per-IP token bucket. Applied to
`/api/upload/sign` at burst 20 / refill 0.5 per second (≈30/min steady
state). In-memory, per-instance — fine for MVP; swap for Upstash Redis
when running multi-region or expecting abuse.

429 responses include a `Retry-After` header in seconds.

### Storage cleanup

`/admin/[eventId]/settings` has a "Clean up storage" button that removes:

1. Orphaned storage objects (uploaded but `finalize` never landed).
2. Soft-deleted media (`status = 'deleted'`) and their storage objects.

There is no grace period — clicking the button is the admin's explicit
intent. The action is in
`src/app/(admin)/admin/[eventId]/settings/cleanup-action.ts`.

### Scheduled hard-delete cron

`migration 0004_deleted_at.sql` adds a `deleted_at` column to `media`
and a trigger that sets it when status flips to `'deleted'` (and clears
it on un-delete).

`/api/cron/cleanup` purges media whose `deleted_at < now() - 7 days`
along with their storage objects. The endpoint is **disabled unless
`CRON_SECRET` is set**; once set, requests must carry
`Authorization: Bearer <CRON_SECRET>`. Vercel cron injects this header
automatically when the schedule is declared in `vercel.json` (already
checked in: `0 3 * * *`).

The manual cleanup button still ignores the grace window — admins can
hard-delete things immediately if they want.

### Upload retry

`src/lib/upload/client-upload.ts` wraps every network step in a small
retry helper (exported — the audio recorder reuses it):

- **sign**: retry on 5xx / network / 404 / 408. Do NOT retry 429 —
  retrying makes the rate-limit worse.
- **PUT to signed URL**: retry on 5xx / network / 408 / 429.
- **finalize**: retry on 5xx / 404 (storage eventual consistency) /
  network. Do NOT retry on 4xx (validation will fail again).

Max 3 attempts each, exponential backoff (1s → 2s → 4s). Progress bar
visibly resets to 0 between attempts so the guest sees activity.

### Pinned dependency gotchas

- **archiver is pinned to v7** (CJS). v8 went pure-ESM with named
  exports only; `import archiver from "archiver"` type-checks against
  `@types/archiver` but is `undefined` at runtime, silently breaking the
  ZIP export. Don't bump to v8 without rewriting the import as
  `import { ZipArchive } from "archiver"` AND adding a local types shim.

### Lint

ESLint 9 flat config in `eslint.config.mjs` (extends
`next/core-web-vitals` + `next/typescript` via FlatCompat).
`npm run lint` must be clean before committing.

### Email confirmation

Supabase has email confirmation toggled in **Auth → Sign In / Up** in the
dashboard. When enabled, `signUp()` returns a user with no session;
`signUpAction()` already detects this and surfaces "Check your email to
confirm…" to the form. Wire SMTP under **Auth → SMTP Settings** in
production — otherwise confirmations queue indefinitely.

### Open Graph

`/e/[slug]` has dynamic OG metadata (`generateMetadata` in
`page.tsx`) so a guest copy-pasting the QR URL into LINE / WhatsApp /
iMessage gets a preview card with the couple's names and welcome
message. Marked `robots: { index: false }` because event pages are
private.

## Phase 6 polish

### i18n (guest side only)

`src/lib/i18n/` provides a typed dictionary keyed on `Lang`
(`'en' | 'zh-Hant'`). Server resolves language in order: `?lang=` query
param → `Accept-Language` header → `'en'` fallback. `zh-tw`, `zh-hk`,
`zh-mo` all map to `zh-Hant`. Pages pass the resolved Lang down as a
prop. Admin surface stays English.

### Custom theme

`events.theme.primaryColor` (hex `#RRGGBB`) is applied to the eyebrow
label and the primary action buttons via inline style + `hover:brightness-90`.
When unset, the default Tailwind blush palette wins. Font selection
and cover-image upload deferred — `next/font` makes runtime font
selection a real project.

### Guest messages

`messages` table holds optional notes posted alongside an upload batch.
Submitted via the same `/api/upload/sign` body (`message` field);
insertion failure is logged but doesn't fail uploads. Admin event page
shows a Messages panel above the media grid with realtime INSERT and
DELETE, hover-to-reveal removal. Realtime payloads don't carry the
joined `guests` row, so freshly-arrived messages show "Guest" until
page reload — known limitation.

### ZIP album export

`/api/admin/events/[id]/export` streams a ZIP of all visible media for
the event. Node.js runtime, `archiver` package, store-mode (no
compression — JPEG/PNG/HEIC don't compress). Sequential downloads keep
memory bounded. `maxDuration = 60` (Vercel Pro). Works comfortably for
albums up to ~500 photos; larger ones may need a smarter
stream-direct-from-storage approach or a one-off batch script.

## Ops / reliability

There is no self-managed server — Vercel (serverless) + Supabase (managed
Postgres/Storage). Uploads go browser → Storage directly, so a Vercel blip
doesn't kill in-flight PUTs. The real wedding-day risks, in order: venue
Wi-Fi, self-inflicted last-minute deploys, Supabase free-tier project
pausing, actual cloud outage.

### Backup

`npm run backup` (`scripts/backup.mjs`) does a full off-site dump:
every table → `backups/backup-<ts>/db/*.json`, every storage object →
`backups/backup-<ts>/storage/…`. Re-runs skip objects already present
with a matching size, so it's cheap to run nightly before the wedding
and once right after. Needs `NEXT_PUBLIC_SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY` (env or `.env.local`); run only from a
trusted machine. `backups/` is gitignored — never commit it.

### Health monitoring

`GET /api/health` checks Postgres + Storage and returns 200/503 with
`{ ok, db, storage, time }` (booleans only — safe to expose). Point a
free uptime monitor (UptimeRobot / Better Stack) at it on a 1–5 min
interval with email/push alerts.

### Wedding-day runbook

1. **Upgrade Supabase to Pro for the wedding month** — the free tier
   pauses projects after ~1 week of inactivity (the most likely "server
   died" scenario), Pro adds daily backups + optional PITR.
2. Freeze deploys 48h before the event.
3. Day before: scan the actual printed QR from a phone on cellular and
   upload one photo end-to-end.
4. Run `npm run backup` the night before and the day after.
5. Low-tech fallback on printed signage: "如遇問題,可 WhatsApp 相片俾
   XXX" — collects photos even if everything digital is down.

## Things deliberately deferred

(Video, per-table QR, i18n, and the hard-delete cron all shipped in later
phases — this list is only what's STILL deferred.)

- Client-side compression of the primary photo path (couples want originals
  for prints; "originals, always" is a market differentiator — 2025-26
  research found competitors get penalized for compressing). An optional
  "low data mode" toggle is acceptable future work.
- EXIF stripping on storage (keep originals for the couple; serve stripped
  variants via image transform if/when media leaves the admin surface)
- Multi-event SaaS billing / tenant isolation (market pricing axes, if ever:
  guest-count cap + upload/hosting window)
- Disposable-camera mode (per-guest shot cap + delayed reveal — strongest
  paid feature in the category; pairs with existing `max_uploads_per_guest`)
- AI face recognition "find my photos" (biggest 2025-26 differentiator, but
  needs a face-embedding service + privacy design)
- Admin triage aids: client-computed dHash + blur score at upload, admin
  grid groups near-dupes / sorts blurriest first
- Offline upload queue (IndexedDB + foreground retry; Background Sync API
  has NO iOS support — don't build on it)
