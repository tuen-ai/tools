import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];

export async function insertMessage(
  admin: SupabaseClient<Database>,
  args: { eventId: string; guestId: string; body: string },
): Promise<{ id: string }> {
  const { data, error } = await admin
    .from("messages")
    .insert({
      event_id: args.eventId,
      guest_id: args.guestId,
      body: args.body,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id };
}

export interface ListMessagesArgs {
  eventId: string;
  offset: number;
  limit: number;
}

export interface MessagesPage {
  rows: Array<
    MessageRow & {
      guests: { display_name: string | null } | null;
    }
  >;
  total: number;
}

export async function listMessagesPage(
  client: SupabaseClient<Database>,
  { eventId, offset, limit }: ListMessagesArgs,
): Promise<MessagesPage> {
  const { data, count, error } = await client
    .from("messages")
    .select("*, guests(display_name)", { count: "exact" })
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return { rows: (data ?? []) as MessagesPage["rows"], total: count ?? 0 };
}

export async function deleteMessage(
  admin: SupabaseClient<Database>,
  id: string,
): Promise<void> {
  const { error } = await admin.from("messages").delete().eq("id", id);
  if (error) throw error;
}
