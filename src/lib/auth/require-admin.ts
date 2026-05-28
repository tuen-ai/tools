import "server-only";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export class AuthorizationError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** RSC helper: get session or redirect to login. */
export async function requireSession() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/admin/login");
  return { user: data.user, supabase };
}

/** RSC helper: ensure the current user has admin access to this event. */
export async function requireEventAdmin(eventId: string) {
  const { user, supabase } = await requireSession();

  const { data, error } = await supabase
    .from("admin_event_access")
    .select("role")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) redirect("/admin");

  return { user, role: data.role, supabase };
}

/**
 * Route-handler / server-action helper. Throws AuthorizationError instead of
 * redirecting, so the caller can shape its own JSON response.
 */
export async function assertEventAdmin(eventId: string): Promise<{
  userId: string;
  role: "owner" | "editor";
}> {
  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    throw new AuthorizationError("not_signed_in", 401);
  }

  // Use service role for the access lookup so we don't depend on RLS being
  // fully evaluated for the calling user (defence in depth).
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("admin_event_access")
    .select("role")
    .eq("event_id", eventId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new AuthorizationError("forbidden", 403);

  return { userId: auth.user.id, role: data.role };
}
