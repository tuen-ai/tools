import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Identity-propagation diagnostic. Compares who the AUTH server thinks is
 * calling (session cookie) with who the DATABASE thinks is calling
 * (auth.uid() via the whoami() RPC, i.e. what RLS policies actually see).
 *
 * Healthy signed-in state:  authApi === database (same uuid).
 * Broken propagation:       authApi = uuid, database = null  ← RLS will
 * reject every insert/select even though login "works".
 *
 * Exposes only the caller's own ids — nothing sensitive.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  const authApi = auth.user?.id ?? null;

  let database: string | null = null;
  let rpcError: string | null = null;
  try {
    const { data, error } = await supabase.rpc("whoami");
    if (error) rpcError = error.message;
    else database = (data as string | null) ?? null;
  } catch (err) {
    rpcError = (err as Error).message;
  }

  return NextResponse.json(
    {
      authApi,
      database,
      match: authApi !== null && authApi === database,
      rpcError,
      rev: (process.env.VERCEL_GIT_COMMIT_SHA ?? "dev").slice(0, 7),
      time: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
