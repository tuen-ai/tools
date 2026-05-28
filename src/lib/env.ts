import { z } from "zod";

// Public env. Safe to read from both server and browser.
// NEXT_PUBLIC_* values are inlined by Next.js at build time.

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
});

const parsed = publicSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

if (!parsed.success) {
  throw new Error(
    `Invalid public environment variables: ${JSON.stringify(
      parsed.error.flatten().fieldErrors,
      null,
      2,
    )}`,
  );
}

export const env = parsed.data;
