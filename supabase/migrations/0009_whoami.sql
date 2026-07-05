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
