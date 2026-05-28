"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-xl bg-ink-900 px-4 py-2 text-white text-sm font-medium hover:bg-ink-700 transition"
    >
      Print
    </button>
  );
}
