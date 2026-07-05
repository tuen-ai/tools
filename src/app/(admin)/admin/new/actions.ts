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
    // Slug regex is the only validation likely to fail in production —
    // surface it with a translatable code; other Zod issues are dev bugs.
    const slugIssue = parsed.error.issues.find((i) => i.path[0] === "slug");
    if (slugIssue) return { ok: false, error: "err_slug_format" };
    return { ok: false, error: "err_invalid_request" };
  }

  const { user } = await requireSession();
  const supabase = await createSupabaseServerClient();

  // redirect() works by THROWING (NEXT_REDIRECT) — it must live outside
  // the try/catch or the catch swallows the navigation and shows
  // "NEXT_REDIRECT" to the user as if creation had failed.
  let row;
  try {
    row = await createEvent(supabase, {
      slug: parsed.data.slug,
      couple_names: parsed.data.couple_names,
      event_date: parsed.data.event_date ?? null,
      welcome_message: parsed.data.welcome_message ?? null,
      created_by: user.id,
    });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("events_slug_key") || msg.includes("duplicate")) {
      return { ok: false, error: "err_slug_taken" };
    }
    return { ok: false, error: msg };
  }
  revalidatePath("/admin");
  redirect(`/admin/${row.id}`);
}
