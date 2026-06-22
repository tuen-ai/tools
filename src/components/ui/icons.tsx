import type { SVGProps } from "react";

/**
 * Delicate line-icon set tuned for the wedding aesthetic: 24×24 grid,
 * 1.6 stroke, rounded caps, `currentColor` so they inherit text color
 * (including the event's custom theme color). Replaces the emoji that
 * previously stood in for iconography across the app — emoji render
 * inconsistently per-OS and clash with the serif / cream palette.
 */

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-5 w-5"
      {...props}
    >
      {children}
    </svg>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2L8 5h8l1.5 2h2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
      <circle cx="12" cy="13" r="3.2" />
    </Base>
  );
}

export function MicIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0" />
      <path d="M12 17v4M9 21h6" />
    </Base>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 20h4l10.5-10.5a2 2 0 0 0-2.83-2.83L5 17.2z" />
      <path d="M14.5 6.5l3 3" />
    </Base>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z" />
      <path d="M18.5 14.5l.7 2 .8.7-.8.6-.7 2-.6-2-.9-.6.9-.7z" />
    </Base>
  );
}

/** Champagne-glass pair — guest count. */
export function GlassIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M7 3l1.6 6a3 3 0 0 0 5.8 0L16 3z" />
      <path d="M11 11.5V19M8.5 21h5" />
    </Base>
  );
}

/** Sealed envelope — message count. */
export function EnvelopeIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3.5 7l8.5 6 8.5-6" />
    </Base>
  );
}

/** Round table seen from above — table marker / count. */
export function TableIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="5" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21" />
    </Base>
  );
}

/** Interlocking rings — events / weddings. */
export function RingsIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="9" cy="14" r="5" />
      <circle cx="15" cy="14" r="5" />
      <path d="M9 4l3 3 3-3" />
    </Base>
  );
}

/** Single bloom — closed / thank-you ornament. */
export function BloomIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="9" r="2.2" />
      <path d="M12 6.8C12 4.5 13.5 3 15 3.5s1.2 3-1 3.8M12 6.8C12 4.5 10.5 3 9 3.5S7.8 6.5 10 7.3M9.8 9.6C7.7 8.6 5.7 9.4 5.6 11s2 2.3 4 1M14.2 9.6c2.1-1 4.1-.2 4.2 1.4s-2 2.3-4 1" />
      <path d="M12 11.2V21M12 21c-2 0-3.5-1-4-3M12 21c2 0 3.5-1 4-3" />
    </Base>
  );
}

/** Ribboned heart — successful upload / gift to the couple. */
export function HeartGiftIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 20s-7-4.3-7-9.2A3.8 3.8 0 0 1 12 8.3 3.8 3.8 0 0 1 19 10.8C19 15.7 12 20 12 20z" />
      <path d="M12 8.3V20M9 5.2c1.2-.2 2.4.6 3 3.1.6-2.5 1.8-3.3 3-3.1" />
    </Base>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </Base>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 4v10M8 10.5l4 4 4-4" />
      <path d="M5 18.5h14" />
    </Base>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 7h16M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7" />
      <path d="M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7" />
      <path d="M10 11v6M14 11v6" />
    </Base>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3 12s3.5-6 9-6c1.4 0 2.7.4 3.8 1M21 12s-3.5 6-9 6c-1.4 0-2.7-.4-3.8-1" />
      <path d="M9.5 9.6a3 3 0 0 0 4.2 4.2M4 4l16 16" />
    </Base>
  );
}
