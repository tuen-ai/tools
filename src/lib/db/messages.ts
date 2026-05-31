import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { STORAGE_BUCKET } from "@/lib/upload/constants";

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];

export async function insertMessage(
  admin: SupabaseClient<Database>,
  args: {
    eventId: string;
    guestId: string;
    body?: string | null;
    audioPath?: string | null;
  },
): Promise<{ id: string }> {
  const { data, error } = await admin
    .from("messages")
    .insert({
      event_id: args.eventId,
      guest_id: args.guestId,
      body: args.body ?? null,
      audio_path: args.audioPath ?? null,
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
  /** Signed audio URLs keyed by message id. 30 minute TTL. */
  audioUrls: Record<string, string>;
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
  const rows = (data ?? []) as MessagesPage["rows"];

  // Batch-sign audio URLs for the page; cheap because most messages
  // are text-only.
  const audioRows = rows.filter((r) => r.audio_path);
  const audioUrls: Record<string, string> = {};
  await Promise.all(
    audioRows.map(async (r) => {
      const { data: signed, error: signErr } = await client.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(r.audio_path!, 1800);
      if (!signErr && signed) audioUrls[r.id] = signed.signedUrl;
    }),
  );

  return { rows, total: count ?? 0, audioUrls };
}

export async function deleteMessage(
  admin: SupabaseClient<Database>,
  id: string,
): Promise<void> {
  // Best-effort: also remove the audio object if present.
  const { data: row } = await admin
    .from("messages")
    .select("audio_path")
    .eq("id", id)
    .maybeSingle();
  if (row?.audio_path) {
    await admin.storage.from(STORAGE_BUCKET).remove([row.audio_path]);
  }
  const { error } = await admin.from("messages").delete().eq("id", id);
  if (error) throw error;
}
