#!/usr/bin/env node
// Full off-site backup: every DB table as JSON + every storage object.
//
//   node scripts/backup.mjs                  → backups/backup-<timestamp>/
//   node scripts/backup.mjs --out /some/dir  → custom destination
//
// Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from the
// environment, falling back to .env.local. Re-runs are cheap: objects
// already present with a matching byte size are skipped, so you can run
// it nightly before the wedding and once right after.
//
// This uses the service-role key — run it ONLY from a machine you trust,
// never commit the key or the backup output. `backups/` is gitignored.

import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const STORAGE_BUCKET = "media";
const TABLES = [
  "events",
  "guests",
  "media",
  "messages",
  "tables",
  "challenges",
  "admin_event_access",
];
const PAGE = 1000; // DB rows per page
const LIST_PAGE = 100; // storage objects per list() call
const DOWNLOAD_CONCURRENCY = 5;

async function loadEnv() {
  const env = { ...process.env };
  try {
    const raw = await readFile(
      path.join(process.cwd(), ".env.local"),
      "utf8",
    );
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // no .env.local — rely on process env
  }
  return env;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

async function dumpTables(supabase, outDir) {
  await mkdir(path.join(outDir, "db"), { recursive: true });
  for (const table of TABLES) {
    const rows = [];
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .range(offset, offset + PAGE - 1);
      if (error) throw new Error(`dump ${table}: ${error.message}`);
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    await writeFile(
      path.join(outDir, "db", `${table}.json`),
      JSON.stringify(rows, null, 2),
    );
    console.log(`  db/${table}.json — ${rows.length} rows`);
  }
}

/** Recursively list every object in the bucket (folders come back with a
 *  null id from Supabase's list(), so we queue those as prefixes). */
async function listAllObjects(supabase) {
  const objects = [];
  const prefixes = [""];
  while (prefixes.length) {
    const prefix = prefixes.pop();
    for (let offset = 0; ; offset += LIST_PAGE) {
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .list(prefix, { limit: LIST_PAGE, offset });
      if (error) throw new Error(`list ${prefix || "/"}: ${error.message}`);
      for (const entry of data ?? []) {
        const full = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id === null) prefixes.push(full);
        else objects.push({ path: full, size: entry.metadata?.size ?? null });
      }
      if (!data || data.length < LIST_PAGE) break;
    }
  }
  return objects;
}

async function downloadObjects(supabase, objects, outDir) {
  const storageDir = path.join(outDir, "storage");
  let done = 0;
  let skipped = 0;
  const failures = [];
  const queue = objects.slice();

  async function worker() {
    while (queue.length) {
      const obj = queue.shift();
      if (!obj) return;
      const dest = path.join(storageDir, obj.path);
      try {
        // Skip when a previous run already fetched the identical object.
        if (obj.size !== null) {
          try {
            const st = await stat(dest);
            if (st.size === obj.size) {
              skipped++;
              continue;
            }
          } catch {
            // not there yet — download below
          }
        }
        const { data, error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .download(obj.path);
        if (error || !data) throw new Error(error?.message ?? "no data");
        await mkdir(path.dirname(dest), { recursive: true });
        await writeFile(dest, Buffer.from(await data.arrayBuffer()));
        done++;
        if ((done + skipped) % 25 === 0) {
          console.log(`  …${done + skipped}/${objects.length}`);
        }
      } catch (err) {
        failures.push({ path: obj.path, error: String(err) });
      }
    }
  }

  await Promise.all(
    Array.from({ length: DOWNLOAD_CONCURRENCY }, () => worker()),
  );
  return { done, skipped, failures };
}

async function main() {
  const env = await loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY " +
        "(set them in the environment or .env.local).",
    );
    process.exit(1);
  }

  const outFlag = process.argv.indexOf("--out");
  const outDir =
    outFlag !== -1 && process.argv[outFlag + 1]
      ? process.argv[outFlag + 1]
      : path.join(process.cwd(), "backups", `backup-${timestamp()}`);

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  console.log(`Backing up to ${outDir}`);
  console.log("Dumping database tables…");
  await dumpTables(supabase, outDir);

  console.log("Listing storage objects…");
  const objects = await listAllObjects(supabase);
  console.log(`Downloading ${objects.length} objects…`);
  const { done, skipped, failures } = await downloadObjects(
    supabase,
    objects,
    outDir,
  );

  console.log("");
  console.log(
    `Done: ${done} downloaded, ${skipped} already present, ${failures.length} failed.`,
  );
  if (failures.length) {
    await writeFile(
      path.join(outDir, "failures.json"),
      JSON.stringify(failures, null, 2),
    );
    console.error("Some objects failed — see failures.json. Re-run to retry.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
