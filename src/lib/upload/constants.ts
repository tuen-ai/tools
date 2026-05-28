// Single source of truth for upload limits. Shared between API and client.

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_FILES_PER_REQUEST = 10;

export const STORAGE_BUCKET = "media";

const MIME_TO_EXT: Record<AllowedMime, string> = {
  "image/jpeg": "jpg",
  "image/png":  "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export function extForMime(mime: AllowedMime): string {
  return MIME_TO_EXT[mime];
}

export function storagePathFor(
  eventId: string,
  mediaId: string,
  mime: AllowedMime,
): string {
  return `events/${eventId}/${mediaId}.${extForMime(mime)}`;
}
