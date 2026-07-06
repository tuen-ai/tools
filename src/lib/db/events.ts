import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PublicEvent } from "@/types/database";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

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

/** Events the signed-in admin has access to. Relies on RLS. */
export async function listAdminEvents(
  client: SupabaseClient<Database>,
): Promise<EventRow[]> {
  const { data, error } = await client
    .from("events")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getEventById(
  client: SupabaseClient<Database>,
  id: string,
): Promise<EventRow | null> {
  const { data, error } = await client
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createEvent(
  client: SupabaseClient<Database>,
  row: Database["public"]["Tables"]["events"]["Insert"],
): Promise<EventRow> {
  const { data, error } = await client
    .from("events")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateEvent(
  client: SupabaseClient<Database>,
  id: string,
  patch: Database["public"]["Tables"]["events"]["Update"],
): Promise<EventRow> {
  const { data, error } = await client
    .from("events")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export interface EventStats {
  guests: number;
  messages: number;
  /** Total bytes of stored media (all statuses — deleted objects survive
   *  until the 7-day cron purge, so they still occupy storage). */
  storageBytes: number;
}

/** Head-only counts + storage total for the dashboard stats row. */
export async function getEventStats(
  client: SupabaseClient<Database>,
  eventId: string,
): Promise<EventStats> {
  const [guests, messages, sizes] = await Promise.all([
    client
      .from("guests")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId),
    client
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId),
    // A wedding tops out at a few thousand rows; pulling the size column and
    // summing in JS avoids needing a SUM() RPC / migration.
    client.from("media").select("size_bytes").eq("event_id", eventId),
  ]);
  if (guests.error) throw guests.error;
  if (messages.error) throw messages.error;
  if (sizes.error) throw sizes.error;
  const storageBytes = (sizes.data ?? []).reduce(
    (sum, r) => sum + (r.size_bytes ?? 0),
    0,
  );
  return {
    guests: guests.count ?? 0,
    messages: messages.count ?? 0,
    storageBytes,
  };
}
