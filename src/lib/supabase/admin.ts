import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import type { Database } from "@/types/database";

// Service-role client. BYPASSES RLS. Server-only — never import from a
// component file. Only route handlers and server actions should touch this.
let cached: SupabaseClient<Database> | null = null;

export function createAdminClient(): SupabaseClient<Database> {
  if (cached) return cached;
  cached = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  return cached;
}
