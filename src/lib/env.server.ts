import "server-only";
import { z } from "zod";

const schema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const parsed = schema.safeParse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
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
