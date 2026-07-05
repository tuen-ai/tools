import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";

// Anon-keyed server client. RLS APPLIES. Use from RSC and route handlers
// for any read that should respect the caller's permissions.
//
// The user's access token is pinned at the FETCH level: production logs
// showed PostgREST receiving requests with `auth_user: null` (so RLS
// rejected them as anon) even though auth.getUser() succeeded in the same
// request. Rather than trust the ssr/supabase-js internals to propagate
// the cookie session into the Authorization header, we resolve the session
// once (cookie read, no network) and overwrite the header on every
// outgoing request as the last step before it leaves the process.
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

  const token = session.access_token;
  const pinnedFetch: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: cookieAdapter,
      global: { fetch: pinnedFetch },
    },
  );
}
