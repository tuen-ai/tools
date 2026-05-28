import "server-only";

// In-memory token-bucket rate limiter. Per-process, per-IP.
//
// Caveats — these are MVP-acceptable but should be revisited at scale:
//   * Vercel serverless functions spin up multiple instances, so the
//     effective rate is N × intended where N = warm instance count.
//   * Cold starts reset every bucket — a determined attacker can spam
//     until a function spin-up forgets them.
//   * Memory grows with unique IPs but is bounded in practice (a wedding
//     reaches a few hundred clients at most).
//
// Swap for Upstash Redis (or similar) in Phase 6 if needed.

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  /** Max tokens (= max instantaneous burst). */
  capacity: number;
  /** Steady-state refill rate, tokens per second. */
  refillPerSec: number;
}

export interface RateLimitResult {
  ok: boolean;
  /** Milliseconds until the next token becomes available; only set on failure. */
  retryAfterMs: number;
  /** Remaining tokens after this call (clamped at 0). */
  remaining: number;
}

export function takeToken(
  key: string,
  options: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);
  const bucket = existing ?? { tokens: options.capacity, lastRefill: now };

  const elapsedSec = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(
    options.capacity,
    bucket.tokens + elapsedSec * options.refillPerSec,
  );
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    buckets.set(key, bucket);
    return {
      ok: true,
      retryAfterMs: 0,
      remaining: Math.floor(bucket.tokens),
    };
  }

  buckets.set(key, bucket);
  const retryAfterMs = Math.ceil(
    ((1 - bucket.tokens) / options.refillPerSec) * 1000,
  );
  return { ok: false, retryAfterMs, remaining: 0 };
}

export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
