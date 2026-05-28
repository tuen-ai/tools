import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** Upsert a guest row keyed on (event_id, client_fingerprint). */
export async function upsertGuest(
  admin: SupabaseClient<Database>,
  args: {
    eventId: string;
    clientFingerprint: string;
    displayName?: string | null;
  },
): Promise<{ id: string }> {
  const { data, error } = await admin
    .from("guests")
    .upsert(
      {
        event_id: args.eventId,
        client_fingerprint: args.clientFingerprint,
        display_name: args.displayName ?? null,
      },
      { onConflict: "event_id,client_fingerprint" },
    )
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id };
}

export async function countGuestMedia(
  admin: SupabaseClient<Database>,
  guestId: string,
): Promise<number> {
  const { count, error } = await admin
    .from("media")
    .select("id", { count: "exact", head: true })
    .eq("guest_id", guestId)
    .neq("status", "deleted");
  if (error) throw error;
  return count ?? 0;
}
