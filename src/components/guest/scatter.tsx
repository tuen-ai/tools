import { BloomIcon, SparkleIcon } from "@/components/ui/icons";

// Decorative scatter behind the guest card — a few engraved-line botanical
// sprigs and sparkles in muted vintage tones at low opacity. The line icons
// (1.6 stroke) read as pressed ornament rather than sticker confetti, in
// keeping with the French-vintage theme. Purely ornamental (aria-hidden),
// pointer-events disabled so it never interferes with the form.
const PIECES = [
  { top: "6%", left: "6%", c: "text-blush-400", s: "h-6 w-6", k: "b" },
  { top: "4%", left: "88%", c: "text-lav-deep", s: "h-5 w-5", k: "s" },
  { top: "32%", left: "92%", c: "text-sage-600", s: "h-6 w-6", k: "b" },
  { top: "60%", left: "3%", c: "text-butter-deep", s: "h-5 w-5", k: "s" },
  { top: "82%", left: "90%", c: "text-blush-400", s: "h-4 w-4", k: "b" },
  { top: "88%", left: "9%", c: "text-sky-deep", s: "h-5 w-5", k: "s" },
] as const;

export function GuestScatter() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {PIECES.map((p, i) => (
        <span
          key={i}
          className={`absolute opacity-30 ${p.c}`}
          style={{ top: p.top, left: p.left }}
        >
          {p.k === "b" ? (
            <BloomIcon className={p.s} />
          ) : (
            <SparkleIcon className={p.s} />
          )}
        </span>
      ))}
    </div>
  );
}
