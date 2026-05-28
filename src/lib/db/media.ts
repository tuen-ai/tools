import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export async function insertMedia(
  admin: SupabaseClient<Database>,
  row: Database["public"]["Tables"]["media"]["Insert"],
): Promise<{ id: string }> {
  const { data, error } = await admin
    .from("media")
    .insert(row)
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id };
}
