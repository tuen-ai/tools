import { HeartFilledIcon, StarFilledIcon } from "@/components/ui/icons";

// Decorative candy scatter behind the guest card — a few hearts and stars
// in soft pastel tones at low opacity. Purely ornamental (aria-hidden),
// pointer-events disabled so it never interferes with the form.
const PIECES = [
  { top: "6%", left: "6%", c: "text-blush-400", s: "h-6 w-6", k: "h" },
  { top: "4%", left: "88%", c: "text-lav", s: "h-5 w-5", k: "s" },
  { top: "32%", left: "92%", c: "text-sage-500", s: "h-6 w-6", k: "h" },
  { top: "60%", left: "3%", c: "text-butter", s: "h-5 w-5", k: "s" },
  { top: "82%", left: "90%", c: "text-blush-400", s: "h-4 w-4", k: "h" },
  { top: "88%", left: "9%", c: "text-sky", s: "h-5 w-5", k: "s" },
] as const;

export function GuestScatter() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {PIECES.map((p, i) => (
        <span
          key={i}
          className={`absolute opacity-50 ${p.c}`}
          style={{ top: p.top, left: p.left }}
        >
          {p.k === "h" ? (
            <HeartFilledIcon className={p.s} />
          ) : (
            <StarFilledIcon className={p.s} />
          )}
        </span>
      ))}
    </div>
  );
}
