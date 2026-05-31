"use client";

import { useActionState, useRef } from "react";

import {
  uploadCoverAction,
  removeCoverAction,
  type CoverActionResult,
} from "./cover-action";

const INITIAL: CoverActionResult = { ok: true };

interface Props {
  eventId: string;
  /** Signed URL of the current cover (if any), good for ~30 min. */
  coverUrl: string | null;
}

export function CoverPanel({ eventId, coverUrl }: Props) {
  const [uploadState, uploadAction, uploadPending] = useActionState(
    uploadCoverAction,
    INITIAL,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeCoverAction,
    INITIAL,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const state = uploadPending ? uploadState : (removeState.error ? removeState : uploadState);

  return (
    <div className="bg-white rounded-3xl shadow-soft p-7 mt-6 space-y-4">
      <div>
        <h2 className="font-serif text-lg text-ink-900">Cover image</h2>
        <p className="text-sm text-ink-500 mt-1">
          A hero image at the top of the upload page. Best in landscape
          (16:9). Under 25 MB. JPEG, PNG, WebP, or HEIC.
        </p>
      </div>

      {coverUrl ? (
        <div className="rounded-2xl overflow-hidden border border-cream-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt="" className="w-full h-40 object-cover" />
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-cream-200 h-40 flex items-center justify-center text-ink-500 text-sm">
          No cover image yet
        </div>
      )}

      <form ref={formRef} action={uploadAction} className="flex flex-wrap gap-2">
        <input type="hidden" name="eventId" value={eventId} />
        <input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          onChange={(e) => {
            if (e.target.files?.length) formRef.current?.requestSubmit();
          }}
          disabled={uploadPending}
          className="text-sm text-ink-700 file:mr-3 file:rounded-xl file:border-0 file:bg-ink-900 file:px-4 file:py-2 file:text-white file:text-sm file:font-medium file:cursor-pointer file:hover:bg-ink-700 file:transition"
        />
        {coverUrl ? (
          <button
            type="submit"
            formAction={removeAction}
            disabled={removePending}
            className="rounded-xl border border-blush-400 text-blush-600 px-4 py-2 text-sm hover:bg-blush-400/10 disabled:opacity-60 transition"
          >
            {removePending ? "Removing…" : "Remove"}
          </button>
        ) : null}
      </form>

      {uploadPending ? (
        <div className="rounded-xl bg-cream-100 px-4 py-3 text-sm text-ink-700">
          Uploading…
        </div>
      ) : null}
      {state.error ? (
        <div className="rounded-xl bg-blush-400/15 px-4 py-3 text-sm text-blush-600">
          {state.error}
        </div>
      ) : null}
    </div>
  );
}
