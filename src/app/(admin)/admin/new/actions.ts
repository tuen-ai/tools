"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSession } from "@/lib/auth/require-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createEvent } from "@/lib/db/events";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

const Schema = z.object({
  couple_names: z.string().trim().min(1).max(120),
  slug: z.string().trim().regex(SLUG_RE, {
    message:
      "Slug must be 3–64 chars, lowercase letters, digits or hyphens, no leading/trailing hyphen.",
  }),
  event_date: z.string().optional(),
  welcome_message: z.string().trim().max(500).optional(),
});

export interface CreateEventResult {
  ok: boolean;
  error?: string;
}

export async function createEventAction(
  _prev: CreateEventResult,
  formData: FormData,
): Promise<CreateEventResult> {
  const parsed = Schema.safeParse({
    couple_names: formData.get("couple_names"),
    slug: formData.get("slug"),
    event_date: formData.get("event_date") || undefined,
    welcome_message: formData.get("welcome_message") || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join(" · "),
    };
  }

  const { user } = await requireSession();
  const supabase = await createSupabaseServerClient();

  try {
    const row = await createEvent(supabase, {
      slug: parsed.data.slug,
      couple_names: parsed.data.couple_names,
      event_date: parsed.data.event_date ?? null,
      welcome_message: parsed.data.welcome_message ?? null,
      created_by: user.id,
    });
    revalidatePath("/admin");
    redirect(`/admin/${row.id}`);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("events_slug_key") || msg.includes("duplicate")) {
      return { ok: false, error: "That URL is already taken — try another." };
    }
    return { ok: false, error: msg };
  }
}
