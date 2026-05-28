import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";

// Browser-only client. Used by client components that need to talk to
// Supabase directly (e.g. Realtime subscriptions in Phase 4). Never use for
// writes that should be permission-checked server-side — go through a
// route handler or server action instead.

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
