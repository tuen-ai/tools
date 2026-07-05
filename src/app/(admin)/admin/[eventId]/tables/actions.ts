"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertEventAdmin, AuthorizationError } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTable, deleteTable } from "@/lib/db/tables";

const CreateSchema = z.object({
  eventId: z.string().uuid(),
  label: z.string().trim().min(1).max(64),
});

const DeleteSchema = z.object({
  eventId: z.string().uuid(),
  tableId: z.string().uuid(),
});

export interface TableActionResult {
  ok: boolean;
  error?: string;
}

export async function createTableAction(
  _prev: TableActionResult,
  formData: FormData,
): Promise<TableActionResult> {
  const parsed = CreateSchema.safeParse({
    eventId: formData.get("eventId"),
    label: formData.get("label"),
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
    await createTable(admin, parsed.data.eventId, parsed.data.label);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return { ok: false, error: "err_table_exists" };
    }
    return { ok: false, error: msg };
  }
  revalidatePath(`/admin/${parsed.data.eventId}/tables`);
  return { ok: true };
}

export async function deleteTableAction(
  input: z.input<typeof DeleteSchema>,
): Promise<TableActionResult> {
  const parsed = DeleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_request" };
  try {
    await assertEventAdmin(parsed.data.eventId);
  } catch (err) {
    if (err instanceof AuthorizationError) return { ok: false, error: err.message };
    throw err;
  }
  const admin = createAdminClient();
  await deleteTable(admin, parsed.data.eventId, parsed.data.tableId);
  revalidatePath(`/admin/${parsed.data.eventId}/tables`);
  return { ok: true };
}
