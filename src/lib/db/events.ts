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
}

/** Head-only counts for the dashboard stats row. */
export async function getEventStats(
  client: SupabaseClient<Database>,
  eventId: string,
): Promise<EventStats> {
  const [guests, messages] = await Promise.all([
    client
      .from("guests")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId),
    client
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId),
  ]);
  if (guests.error) throw guests.error;
  if (messages.error) throw messages.error;
  return { guests: guests.count ?? 0, messages: messages.count ?? 0 };
}
