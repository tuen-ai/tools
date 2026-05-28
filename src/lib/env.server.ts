import "server-only";
import { z } from "zod";

const schema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Optional. If set, admin signups must supply this code. If unset,
  // signups are closed (the only way to add admins is via the Supabase
  // dashboard or by setting this env var).
  ADMIN_SIGNUP_INVITE_CODE: z.string().min(8).optional(),
  // Optional. If set, /api/cron/cleanup requires Bearer <secret>.
  // Without it the endpoint is disabled. Vercel cron injects
  // Authorization: Bearer <CRON_SECRET> automatically when configured.
  CRON_SECRET: z.string().min(16).optional(),
});

const parsed = schema.safeParse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  ADMIN_SIGNUP_INVITE_CODE: process.env.ADMIN_SIGNUP_INVITE_CODE,
  CRON_SECRET: process.env.CRON_SECRET,
});

if (!parsed.success) {
  throw new Error(
    `Invalid server environment variables: ${JSON.stringify(
      parsed.error.flatten().fieldErrors,
      null,
      2,
    )}`,
  );
}

export const serverEnv = parsed.data;
