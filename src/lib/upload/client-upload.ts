import { isVideoMime, type AllowedMime } from "@/lib/upload/constants";

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
  tableId: string | null;
  items: Array<{
    mediaId: string;
    storagePath: string;
    signedUrl: string;
    token: string;
  }>;
}

const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 1000;

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function isRetryableStatus(status: number): boolean {
  // 408 timeout, 429 rate-limit (with backoff this is fine), 5xx server,
  // 404 because Supabase Storage is eventually consistent — the HEAD in
  // finalize occasionally races a just-uploaded PUT.
  if (status === 404 || status === 408 || status === 429) return true;
  if (status >= 500 && status < 600) return true;
  return false;
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  isRetryable: (err: unknown) => boolean,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    try {
      return await fn(i);
    } catch (err) {
      lastErr = err;
      if (i === MAX_ATTEMPTS || !isRetryable(err)) break;
      const delay = RETRY_BASE_MS * Math.pow(2, i - 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
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
      else reject(new HttpError(xhr.status, `HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.ontimeout = () => reject(new Error("Network timeout"));
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
    return null;
  }
}

/** Reads <video> metadata to get dimensions. */
async function readVideoDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => {
      const dims = { width: v.videoWidth, height: v.videoHeight };
      URL.revokeObjectURL(url);
      resolve(dims.width > 0 ? dims : null);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    v.src = url;
  });
}

interface UploadOptions {
  eventSlug: string;
  clientFingerprint: string;
  displayName: string | null;
  message: string | null;
  tableLabel: string | null;
  items: UploadItem[];
  onItemChange: (id: string, patch: Partial<UploadItem>) => void;
  concurrency?: number;
}

export async function uploadGuestPhotos(opts: UploadOptions): Promise<void> {
  const {
    eventSlug,
    clientFingerprint,
    displayName,
    message,
    tableLabel,
    items,
    onItemChange,
  } = opts;
  const concurrency = opts.concurrency ?? 3;

  // 1) Mint signed URLs — retry on transient failures, but NOT on 429
  //    (sign is the place we apply IP rate-limiting; retrying compounds it).
  const sign = await withRetry(
    async () => {
      const res = await fetch("/api/upload/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventSlug,
          clientFingerprint,
          displayName: displayName?.trim() || null,
          message: message?.trim() || null,
          tableLabel: tableLabel?.trim() || null,
          files: items.map((it) => ({
            mime: it.file.type as AllowedMime,
            size: it.file.size,
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new HttpError(res.status, body.error ?? `sign_failed_${res.status}`);
      }
      return (await res.json()) as SignResponse;
    },
    (err) => {
      if (err instanceof HttpError) {
        if (err.status === 429) return false; // rate-limited; abort
        return isRetryableStatus(err.status);
      }
      return true; // network/timeout
    },
  );

  // 2) Per-file upload with retry, then finalize with retry.
  const paired = items.map((item, i) => ({ item, slot: sign.items[i] }));

  const queue = paired.slice();
  async function worker() {
    while (queue.length) {
      const next = queue.shift();
      if (!next) return;
      const { item, slot } = next;

      onItemChange(item.id, { status: "uploading", progress: 0 });

      try {
        // PUT to signed URL — retry network/5xx; do NOT retry 4xx (bad
        // signature, wrong content-type, etc.).
        await withRetry(
          async (attempt) => {
            if (attempt > 1) onItemChange(item.id, { progress: 0 });
            await putWithProgress(slot.signedUrl, item.file, (pct) =>
              onItemChange(item.id, { progress: pct }),
            );
          },
          (err) =>
            err instanceof HttpError ? isRetryableStatus(err.status) : true,
        );

        const dims = isVideoMime(item.file.type)
          ? await readVideoDimensions(item.file)
          : await readImageDimensions(item.file);

        // Finalize with retry — 404 is retryable (storage eventual
        // consistency), 400 is not (size or path mismatch will recur).
        await withRetry(
          async () => {
            const res = await fetch("/api/media/finalize", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                mediaId: slot.mediaId,
                eventId: sign.eventId,
                guestId: sign.guestId,
                tableId: sign.tableId,
                storagePath: slot.storagePath,
                mime: item.file.type,
                size: item.file.size,
                ...(dims ?? {}),
              }),
            });
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              throw new HttpError(
                res.status,
                body.error ?? `finalize_failed_${res.status}`,
              );
            }
          },
          (err) =>
            err instanceof HttpError ? isRetryableStatus(err.status) : true,
        );

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
