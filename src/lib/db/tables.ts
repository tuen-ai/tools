import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type TableRow = Database["public"]["Tables"]["tables"]["Row"];

export async function listTables(
  client: SupabaseClient<Database>,
  eventId: string,
): Promise<TableRow[]> {
  const { data, error } = await client
    .from("tables")
    .select("*")
    .eq("event_id", eventId)
    .order("label", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createTable(
  admin: SupabaseClient<Database>,
  eventId: string,
  label: string,
): Promise<TableRow> {
  const { data, error } = await admin
    .from("tables")
    .insert({ event_id: eventId, label })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTable(
  admin: SupabaseClient<Database>,
  eventId: string,
  id: string,
): Promise<void> {
  // Scope to eventId — the service-role client bypasses RLS, so without
  // this an admin of one event could delete another event's row by id.
  const { error } = await admin
    .from("tables")
    .delete()
    .eq("id", id)
    .eq("event_id", eventId);
  if (error) throw error;
}
