import type { AllowedMime } from "@/lib/upload/constants";

export type UploadItemStatus = "pending" | "uploading" | "done" | "failed";

export interface UploadItem {
  id: string;
  file: File;
  status: UploadItemStatus;
  progress: number;
  error?: string;
  mediaId?: string;
}

interface SignResponse {
  eventId: string;
  guestId: string;
  items: Array<{
    mediaId: string;
    storagePath: string;
    signedUrl: string;
    token: string;
  }>;
}

/** Uploads a single file to a signed Supabase Storage URL with progress. */
function putWithProgress(
  signedUrl: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}

async function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    const bmp = await createImageBitmap(file);
    const dims = { width: bmp.width, height: bmp.height };
    bmp.close?.();
    return dims;
  } catch {
    return null; // HEIC etc. may not decode in some browsers — that's fine.
  }
}

interface UploadOptions {
  eventSlug: string;
  clientFingerprint: string;
  displayName: string | null;
  items: UploadItem[];
  onItemChange: (id: string, patch: Partial<UploadItem>) => void;
  concurrency?: number;
}

/**
 * Drives the full guest upload flow: mint signed URLs, PUT in parallel
 * with progress, then finalize each row.
 */
export async function uploadGuestPhotos(opts: UploadOptions): Promise<void> {
  const { eventSlug, clientFingerprint, displayName, items, onItemChange } =
    opts;
  const concurrency = opts.concurrency ?? 3;

  // 1) Mint signed URLs (one round-trip for the whole batch).
  const signRes = await fetch("/api/upload/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventSlug,
      clientFingerprint,
      displayName: displayName?.trim() || null,
      files: items.map((it) => ({
        mime: it.file.type as AllowedMime,
        size: it.file.size,
      })),
    }),
  });

  if (!signRes.ok) {
    const body = await signRes.json().catch(() => ({}));
    throw new Error(body.error ?? `sign_failed_${signRes.status}`);
  }
  const sign = (await signRes.json()) as SignResponse;

  // 2) Pair each UI item with its server-issued slot (by order — the API
  //    returns items in the same order they were sent).
  const paired = items.map((item, i) => ({ item, slot: sign.items[i] }));

  // 3) Bounded-concurrency runner.
  const queue = paired.slice();
  async function worker() {
    while (queue.length) {
      const next = queue.shift();
      if (!next) return;
      const { item, slot } = next;

      onItemChange(item.id, { status: "uploading", progress: 0 });

      try {
        await putWithProgress(slot.signedUrl, item.file, (pct) =>
          onItemChange(item.id, { progress: pct }),
        );

        const dims = await readImageDimensions(item.file);

        const finalizeRes = await fetch("/api/media/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mediaId: slot.mediaId,
            eventId: sign.eventId,
            guestId: sign.guestId,
            storagePath: slot.storagePath,
            mime: item.file.type,
            size: item.file.size,
            ...(dims ?? {}),
          }),
        });
        if (!finalizeRes.ok) {
          const body = await finalizeRes.json().catch(() => ({}));
          throw new Error(body.error ?? `finalize_failed_${finalizeRes.status}`);
        }

        onItemChange(item.id, {
          status: "done",
          progress: 100,
          mediaId: slot.mediaId,
        });
      } catch (err) {
        onItemChange(item.id, {
          status: "failed",
          error: (err as Error).message,
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, paired.length) }, worker),
  );
}
