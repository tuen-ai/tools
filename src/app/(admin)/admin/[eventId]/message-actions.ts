"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertEventAdmin, AuthorizationError } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteMessage } from "@/lib/db/messages";

const Schema = z.object({
  eventId: z.string().uuid(),
  messageId: z.string().uuid(),
});

export interface MessageActionResult {
  ok: boolean;
  error?: string;
}

export async function deleteMessageAction(
  input: z.input<typeof Schema>,
): Promise<MessageActionResult> {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_request" };

  try {
    await assertEventAdmin(parsed.data.eventId);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  const admin = createAdminClient();
  await deleteMessage(admin, parsed.data.eventId, parsed.data.messageId);
  revalidatePath(`/admin/${parsed.data.eventId}`);
  return { ok: true };
}
