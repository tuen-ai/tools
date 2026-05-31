// Single source of truth for upload limits. Shared between API and client.

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;        // 25 MB images
export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;      // 100 MB videos
export const MAX_VIDEO_DURATION_SEC = 30;                    // 30 second cap

export const ALLOWED_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const ALLOWED_VIDEO_MIMES = [
  "video/mp4",
  "video/quicktime",   // iPhone .mov
  "video/webm",
] as const;

export const ALLOWED_MIME_TYPES = [
  ...ALLOWED_IMAGE_MIMES,
  ...ALLOWED_VIDEO_MIMES,
] as const;

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIMES)[number];
export type AllowedVideoMime = (typeof ALLOWED_VIDEO_MIMES)[number];
export type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_FILES_PER_REQUEST = 10;

export const STORAGE_BUCKET = "media";

const EXT_FOR_MIME: Record<AllowedMime, string> = {
  "image/jpeg":      "jpg",
  "image/png":       "png",
  "image/webp":      "webp",
  "image/heic":      "heic",
  "image/heif":      "heif",
  "video/mp4":       "mp4",
  "video/quicktime": "mov",
  "video/webm":      "webm",
};

export function isVideoMime(mime: string): mime is AllowedVideoMime {
  return (ALLOWED_VIDEO_MIMES as readonly string[]).includes(mime);
}

export function isImageMime(mime: string): mime is AllowedImageMime {
  return (ALLOWED_IMAGE_MIMES as readonly string[]).includes(mime);
}

export function maxSizeFor(mime: string): number {
  return isVideoMime(mime) ? MAX_VIDEO_SIZE_BYTES : MAX_FILE_SIZE_BYTES;
}

export function extForMime(mime: AllowedMime): string {
  return EXT_FOR_MIME[mime];
}

export function storagePathFor(
  eventId: string,
  mediaId: string,
  mime: AllowedMime,
): string {
  return `events/${eventId}/${mediaId}.${extForMime(mime)}`;
}
