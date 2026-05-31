"use client";

import { useEffect, useRef, useState } from "react";

import { DICT, type Lang } from "@/lib/i18n";

const MAX_DURATION_SEC = 30;

type Phase = "idle" | "recording" | "preview" | "sending" | "done" | "error";

interface Props {
  lang: Lang;
  eventSlug: string;
  clientFingerprint: string;
  displayName: string | null;
  primaryColor: string | null;
  /** Called once the recording has been sent successfully. */
  onSent: () => void;
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
    } catch (err) {
      setPhase("error");
      setError(
        lang === "zh-Hant"
          ? "無法存取麥克風,請允許瀏覽器使用咪。"
          : "Microphone access denied. Please grant permission to record.",
      );
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

  async function send() {
    if (!blob) return;
    setPhase("sending");
    setError(null);
    try {
      const mime = normaliseMime(blob.type || "audio/webm");
      const signRes = await fetch("/api/messages/audio/sign", {
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
      if (!signRes.ok) {
        const body = await signRes.json().catch(() => ({}));
        throw new Error(body.error ?? `sign_failed_${signRes.status}`);
      }
      const sign = (await signRes.json()) as {
        messageId: string;
        eventId: string;
        guestId: string;
        storagePath: string;
        signedUrl: string;
      };

      const putRes = await fetch(sign.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": mime, "x-upsert": "false" },
        body: blob,
      });
      if (!putRes.ok) throw new Error(`upload_failed_${putRes.status}`);

      const finalizeRes = await fetch("/api/messages/audio/finalize", {
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
      if (!finalizeRes.ok) {
        const body = await finalizeRes.json().catch(() => ({}));
        throw new Error(body.error ?? `finalize_failed_${finalizeRes.status}`);
      }

      setPhase("done");
      onSent();
      // Reset for another recording.
      discard();
    } catch (err) {
      setPhase("error");
      setError((err as Error).message);
    }
  }

  const primaryStyle = primaryColor
    ? { backgroundColor: primaryColor }
    : undefined;

  return (
    <div className="rounded-2xl border border-cream-200 bg-cream-50 p-5">
      {phase === "idle" ? (
        <button
          type="button"
          onClick={startRecording}
          className={
            primaryColor
              ? "w-full rounded-xl px-4 py-4 text-white text-sm font-medium hover:brightness-90 transition flex items-center justify-center gap-2"
              : "w-full rounded-xl bg-blush-500 px-4 py-4 text-white text-sm font-medium hover:bg-blush-600 transition flex items-center justify-center gap-2"
          }
          style={primaryStyle}
        >
          <RecDot active /> {lang === "zh-Hant" ? "開始錄音" : "Start recording"}
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
            className="rounded-xl bg-ink-900 px-5 py-2.5 text-white text-sm font-medium hover:bg-ink-700 transition"
          >
            {lang === "zh-Hant" ? "停止" : "Stop"}
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
              className="flex-1 rounded-xl bg-cream-100 px-4 py-3 text-sm text-ink-700 hover:bg-cream-200 transition"
            >
              {lang === "zh-Hant" ? "重新錄製" : "Re-record"}
            </button>
            <button
              type="button"
              onClick={send}
              className={
                primaryColor
                  ? "flex-1 rounded-xl px-4 py-3 text-white text-sm font-medium hover:brightness-90 transition"
                  : "flex-1 rounded-xl bg-blush-500 px-4 py-3 text-white text-sm font-medium hover:bg-blush-600 transition"
              }
              style={primaryStyle}
            >
              {lang === "zh-Hant" ? "送出" : t.send(1)}
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
        <div className="rounded-xl bg-blush-400/15 px-4 py-3 text-sm text-blush-600 mt-3">
          {error}
          <button
            type="button"
            onClick={discard}
            className="ml-2 underline"
          >
            {lang === "zh-Hant" ? "重試" : "Retry"}
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
