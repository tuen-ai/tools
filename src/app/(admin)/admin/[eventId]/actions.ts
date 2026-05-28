"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertEventAdmin, AuthorizationError } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMedia, setMediaStatus } from "@/lib/db/media";

const Schema = z.object({
  mediaId: z.string().uuid(),
  status: z.enum(["visible", "hidden", "deleted"]),
});

export interface MediaActionResult {
  ok: boolean;
  error?: string;
}

export async function setMediaStatusAction(
  input: z.input<typeof Schema>,
): Promise<MediaActionResult> {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_request" };

  const admin = createAdminClient();
  const media = await getMedia(admin, parsed.data.mediaId);
  if (!media) return { ok: false, error: "not_found" };

  try {
    await assertEventAdmin(media.event_id);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  await setMediaStatus(admin, parsed.data.mediaId, parsed.data.status);
  revalidatePath(`/admin/${media.event_id}`);
  return { ok: true };
}
