import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";

// Anon-keyed server client. RLS APPLIES. Use from RSC and route handlers
// for any read that should respect the caller's permissions.
//
// The user's access token is pinned as an explicit Authorization header.
// In production we observed PostgREST receiving requests with
// `auth_user: null` (RLS then rejects as anon) even though auth.getUser()
// succeeded — the implicit cookie-session → Authorization propagation
// can't be relied on across ssr/supabase-js version combinations, so we
// resolve the session once and construct the client with the header baked
// in. getSession() only reads the cookie (no network), so the second
// construction is cheap.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  const cookieAdapter = {
    getAll() {
      return cookieStore.getAll();
    },
    setAll(toSet: { name: string; value: string; options: CookieOptions }[]) {
      try {
        for (const { name, value, options } of toSet) {
          cookieStore.set(name, value, options);
        }
      } catch {
        // Called from a Server Component; ignore — Next forbids cookie writes there.
      }
    },
  };

  const probe = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: cookieAdapter },
  );
  const {
    data: { session },
  } = await probe.auth.getSession();

  if (!session?.access_token) return probe; // anonymous caller — RLS as anon

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: cookieAdapter,
      global: {
        headers: { Authorization: `Bearer ${session.access_token}` },
      },
    },
  );
}
