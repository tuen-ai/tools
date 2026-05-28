import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PublicEvent } from "@/types/database";

export async function getEventBySlug(
  client: SupabaseClient<Database>,
  slug: string,
): Promise<PublicEvent | null> {
  const { data, error } = await client.rpc("get_event_by_slug", {
    p_slug: slug,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}
