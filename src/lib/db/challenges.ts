import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type ChallengeRow = Database["public"]["Tables"]["challenges"]["Row"];

export async function listChallenges(
  client: SupabaseClient<Database>,
  eventId: string,
): Promise<ChallengeRow[]> {
  const { data, error } = await client
    .from("challenges")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createChallenge(
  admin: SupabaseClient<Database>,
  eventId: string,
  prompt: string,
): Promise<ChallengeRow> {
  const { data, error } = await admin
    .from("challenges")
    .insert({ event_id: eventId, prompt })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteChallenge(
  admin: SupabaseClient<Database>,
  id: string,
): Promise<void> {
  const { error } = await admin.from("challenges").delete().eq("id", id);
  if (error) throw error;
}
