import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";

// Anon-keyed server client. RLS APPLIES. Use from RSC and route handlers
// for any read that should respect the caller's permissions.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          toSet: { name: string; value: string; options: CookieOptions }[],
        ) {
          try {
            for (const { name, value, options } of toSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component; ignore — Next forbids cookie writes there.
          }
        },
      },
    },
  );
}
