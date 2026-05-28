"use client";

import { useState, useTransition } from "react";

import {
  cleanupStorageAction,
  type CleanupResult,
} from "./cleanup-action";

export function CleanupPanel({ eventId }: { eventId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CleanupResult | null>(null);

  function run() {
    const ok = window.confirm(
      "This permanently removes any photos you've deleted, plus any stray uploads that never finished. There is no undo. Continue?",
    );
    if (!ok) return;
    startTransition(async () => {
      const r = await cleanupStorageAction({ eventId });
      setResult(r);
    });
  }

  return (
    <div className="bg-white rounded-3xl shadow-soft p-7 mt-6 space-y-3">
      <div>
        <h2 className="font-serif text-lg text-ink-900">Storage maintenance</h2>
        <p className="text-sm text-ink-500 mt-1">
          Permanently remove deleted photos and stray uploads. Run this
          once you’ve finished curating the album.
        </p>
      </div>

      {result?.ok ? (
        <div className="rounded-xl bg-sage-500/15 px-4 py-3 text-sm text-sage-600">
          Removed {result.orphansDeleted ?? 0} stray upload
          {result.orphansDeleted === 1 ? "" : "s"} and{" "}
          {result.staleDeleted ?? 0} deleted photo
          {result.staleDeleted === 1 ? "" : "s"}.
        </div>
      ) : null}
      {result && !result.ok ? (
        <div className="rounded-xl bg-blush-400/15 px-4 py-3 text-sm text-blush-600">
          {result.error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="w-full rounded-xl border border-blush-400 text-blush-600 px-4 py-3 text-sm font-medium hover:bg-blush-400/10 disabled:opacity-60 transition"
      >
        {pending ? "Cleaning up…" : "Clean up storage"}
      </button>
    </div>
  );
}
