"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertEventAdmin, AuthorizationError } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateEvent } from "@/lib/db/events";

const Schema = z.object({
  eventId: z.string().uuid(),
  couple_names: z.string().trim().min(1).max(120),
  welcome_message: z.string().trim().max(500).optional(),
  event_date: z.string().optional(),
  upload_enabled: z.boolean(),
  max_uploads_per_guest: z.coerce.number().int().min(1).max(500),
});

export interface UpdateEventResult {
  ok: boolean;
  saved?: boolean;
  error?: string;
}

export async function updateEventAction(
  _prev: UpdateEventResult,
  formData: FormData,
): Promise<UpdateEventResult> {
  const parsed = Schema.safeParse({
    eventId: formData.get("eventId"),
    couple_names: formData.get("couple_names"),
    welcome_message: formData.get("welcome_message") || undefined,
    event_date: formData.get("event_date") || undefined,
    upload_enabled: formData.get("upload_enabled") === "on",
    max_uploads_per_guest: formData.get("max_uploads_per_guest"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join(" · "),
    };
  }

  try {
    await assertEventAdmin(parsed.data.eventId);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  const admin = createAdminClient();
  await updateEvent(admin, parsed.data.eventId, {
    couple_names: parsed.data.couple_names,
    welcome_message: parsed.data.welcome_message ?? null,
    event_date: parsed.data.event_date ?? null,
    upload_enabled: parsed.data.upload_enabled,
    max_uploads_per_guest: parsed.data.max_uploads_per_guest,
  });

  revalidatePath(`/admin/${parsed.data.eventId}`);
  revalidatePath(`/admin/${parsed.data.eventId}/settings`);
  revalidatePath("/admin");
  return { ok: true, saved: true };
}
