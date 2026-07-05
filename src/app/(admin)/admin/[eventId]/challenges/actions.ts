"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertEventAdmin, AuthorizationError } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createChallenge, deleteChallenge } from "@/lib/db/challenges";

const CreateSchema = z.object({
  eventId: z.string().uuid(),
  prompt: z.string().trim().min(1).max(120),
});

const DeleteSchema = z.object({
  eventId: z.string().uuid(),
  challengeId: z.string().uuid(),
});

export interface ChallengeActionResult {
  ok: boolean;
  error?: string;
}

export async function createChallengeAction(
  _prev: ChallengeActionResult,
  formData: FormData,
): Promise<ChallengeActionResult> {
  const parsed = CreateSchema.safeParse({
    eventId: formData.get("eventId"),
    prompt: formData.get("prompt"),
  });
  if (!parsed.success) {
    return { ok: false, error: "invalid_request" };
  }
  try {
    await assertEventAdmin(parsed.data.eventId);
  } catch (err) {
    if (err instanceof AuthorizationError) return { ok: false, error: err.message };
    throw err;
  }
  const admin = createAdminClient();
  try {
    await createChallenge(admin, parsed.data.eventId, parsed.data.prompt);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return { ok: false, error: "err_challenge_exists" };
    }
    return { ok: false, error: msg };
  }
  revalidatePath(`/admin/${parsed.data.eventId}/challenges`);
  return { ok: true };
}

export async function deleteChallengeAction(
  input: z.input<typeof DeleteSchema>,
): Promise<ChallengeActionResult> {
  const parsed = DeleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_request" };
  try {
    await assertEventAdmin(parsed.data.eventId);
  } catch (err) {
    if (err instanceof AuthorizationError) return { ok: false, error: err.message };
    throw err;
  }
  const admin = createAdminClient();
  await deleteChallenge(admin, parsed.data.eventId, parsed.data.challengeId);
  revalidatePath(`/admin/${parsed.data.eventId}/challenges`);
  return { ok: true };
}
