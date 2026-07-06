"use client";

import { useEffect, useRef, useState } from "react";

import { DICT, lookupUploadError, type Lang } from "@/lib/i18n";
import {
  HttpError,
  isRetryableStatus,
  withRetry,
} from "@/lib/upload/client-upload";

const MAX_DURATION_SEC = 30;

type Phase = "idle" | "recording" | "preview" | "sending" | "done" | "error";

export interface VoiceClip {
  messageId: string;
  /** Local blob URL — the parent owns the lifecycle and revokes when done. */
  audioUrl: string;
  durationSec: number;
}

interface Props {
  lang: Lang;
  eventSlug: string;
  clientFingerprint: string;
  displayName: string | null;
  primaryColor: string | null;
  /** When true the idle button reads "Record another" instead of "Start
   *  recording" — the parent flips this on once at least one clip exists. */
  hasExistingClips?: boolean;
  /** Called once the recording has been sent successfully. The parent then
   *  owns the audio blob URL (so the guest can re-listen to it as a tile)
   *  and is responsible for revoking it on unmount or delete. */
  onSent: (clip: VoiceClip) => void;
}

/** Pick a MIME type the current browser will actually record. */
function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "audio/webm";
}

/** Strip codec suffix → server-accepted MIME ("audio/webm" / "audio/mp4"). */
function normaliseMime(m: string): string {
  return m.split(";")[0]!.trim();
}

export function AudioRecorder({
  lang,
  eventSlug,
  clientFingerprint,
  displayName,
  primaryColor,
  hasExistingClips,
  onSent,
}: Props) {
  const t = DICT[lang];
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const stopTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount.
      stopTracks();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopTracks() {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  }

  async function startRecording() {
    setError(null);
    setElapsed(0);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      const mr = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const recordedBlob = new Blob(chunksRef.current, { type: mime });
        const url = URL.createObjectURL(recordedBlob);
        setBlob(recordedBlob);
        setPreviewUrl(url);
        setPhase("preview");
        stopTracks();
      };

      mr.start();
      setPhase("recording");

      timerRef.current = window.setInterval(() => {
        setElapsed((s) => s + 1);
      }, 1000);
      stopTimerRef.current = window.setTimeout(() => {
        if (mr.state === "recording") mr.stop();
      }, MAX_DURATION_SEC * 1000);
    } catch {
      setPhase("error");
      setError(t.micDenied);
    }
  }

  function stopRecording() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    timerRef.current = null;
    stopTimerRef.current = null;
    mediaRecorderRef.current?.stop();
  }

  function discard() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setBlob(null);
    setPreviewUrl(null);
    setElapsed(0);
    setPhase("idle");
  }

  /** Reset for another recording WITHOUT revoking the preview URL — used
   *  after a successful send, since the parent now owns that URL. */
  function resetAfterSend() {
    setBlob(null);
    setPreviewUrl(null);
    setElapsed(0);
    setPhase("idle");
  }

  async function send() {
    if (!blob) return;
    setPhase("sending");
    setError(null);
    try {
      const mime = normaliseMime(blob.type || "audio/webm");

      // Same retry posture as the photo flow: don't retry our own 429
      // on sign (it's the rate limiter), retry transient errors elsewhere.
      const sign = await withRetry(
        async () => {
          const res = await fetch("/api/messages/audio/sign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventSlug,
              clientFingerprint,
              displayName: displayName?.trim() || null,
              audioMime: mime,
              audioSize: blob.size,
            }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new HttpError(res.status, body.error ?? `sign_failed_${res.status}`);
          }
          return (await res.json()) as {
            messageId: string;
            eventId: string;
            guestId: string;
            storagePath: string;
            signedUrl: string;
          };
        },
        (err) =>
          err instanceof HttpError
            ? err.status !== 429 && isRetryableStatus(err.status)
            : true,
      );

      await withRetry(
        async () => {
          const res = await fetch(sign.signedUrl, {
            method: "PUT",
            headers: { "Content-Type": mime, "x-upsert": "false" },
            body: blob,
          });
          if (!res.ok) throw new HttpError(res.status, `upload_failed_${res.status}`);
        },
        (err) =>
          err instanceof HttpError ? isRetryableStatus(err.status) : true,
      );

      const finalizeRes = await withRetry(
        async () => {
          const res = await fetch("/api/messages/audio/finalize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messageId: sign.messageId,
              eventId: sign.eventId,
              guestId: sign.guestId,
              storagePath: sign.storagePath,
              audioSize: blob.size,
            }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new HttpError(res.status, body.error ?? `finalize_failed_${res.status}`);
          }
          return (await res.json()) as { id: string; playbackUrl: string | null };
        },
        (err) =>
          err instanceof HttpError ? isRetryableStatus(err.status) : true,
      );

      setPhase("done");
      // Play the sent clip from the signed SERVER url (proper file, seekable,
      // cross-browser). Fall back to the local blob only if signing failed.
      // The local blob is no longer needed for the tile — revoke it.
      const playbackUrl = finalizeRes?.playbackUrl ?? previewUrl!;
      if (finalizeRes?.playbackUrl && previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      onSent({
        messageId: sign.messageId,
        audioUrl: playbackUrl,
        durationSec: elapsed,
      });
      resetAfterSend();
    } catch (err) {
      setPhase("error");
      setError(lookupUploadError(t, (err as Error).message));
    }
  }

  // One button shape (letterpress .btn-candy); a custom theme colour just
  // overrides the fill via inline style.
  const primaryStyle = primaryColor
    ? { backgroundColor: primaryColor, boxShadow: "none" }
    : undefined;

  return (
    <div className="rounded-2xl border border-cream-200 bg-cream-50 p-5">
      {phase === "idle" ? (
        <button
          type="button"
          onClick={startRecording}
          className="w-full btn-candy px-4 py-4 text-sm flex items-center justify-center gap-2"
          style={primaryStyle}
        >
          <RecDot active /> {hasExistingClips ? t.recRecordAnother : t.recStart}
        </button>
      ) : null}

      {phase === "recording" ? (
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span
              className="h-3 w-3 rounded-full bg-blush-600 animate-pulse"
              aria-hidden
            />
            <span className="font-mono text-2xl text-ink-900">
              {fmt(elapsed)} / {fmt(MAX_DURATION_SEC)}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-cream-100 overflow-hidden mb-4">
            <div
              className="h-full bg-blush-500 transition-all"
              style={{ width: `${(elapsed / MAX_DURATION_SEC) * 100}%` }}
            />
          </div>
          <button
            type="button"
            onClick={stopRecording}
            className="btn-candy px-8 py-3.5 text-base"
          >
            {t.recStop}
          </button>
        </div>
      ) : null}

      {phase === "preview" && previewUrl ? (
        <div className="space-y-3">
          <audio
            src={previewUrl}
            controls
            className="w-full"
            preload="metadata"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={discard}
              className="flex-1 btn-soft px-4 py-3 text-sm"
            >
              {t.recRerecord}
            </button>
            <button
              type="button"
              onClick={send}
              className="flex-1 btn-candy px-4 py-3 text-sm"
              style={primaryStyle}
            >
              {t.recSend}
            </button>
          </div>
        </div>
      ) : null}

      {phase === "sending" ? (
        <div className="text-center text-sm text-ink-700 py-3">
          {t.sending(0, 1)}
        </div>
      ) : null}

      {phase === "error" && error ? (
        <div className="rounded-xl bg-blush-400/15 px-4 py-3 text-sm text-blush-700 mt-3">
          {error}
          <button
            type="button"
            // On a SEND failure the recording is still in state — return to
            // preview so the guest can re-send or re-record WITHOUT losing
            // their 30-second clip. Only a mic-permission error (no blob)
            // resets to idle.
            onClick={() => {
              setError(null);
              if (blob) setPhase("preview");
              else discard();
            }}
            className="ml-2 underline"
          >
            {t.retry}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function RecDot({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-2.5 w-2.5 rounded-full ${
        active ? "bg-white" : "bg-blush-600"
      }`}
    />
  );
}
