"use client";

import { useEffect, useRef, useState } from "react";

import {
  ALLOWED_MIME_TYPES,
  MAX_FILES_PER_REQUEST,
  MAX_VIDEO_DURATION_SEC,
  isVideoMime,
  maxSizeFor,
  type AllowedMime,
} from "@/lib/upload/constants";
import {
  uploadGuestPhotos,
  type UploadItem,
} from "@/lib/upload/client-upload";
import { DICT, type Lang } from "@/lib/i18n";
import { AudioRecorder } from "@/components/guest/audio-recorder";
import {
  CameraIcon,
  MicIcon,
  PencilIcon,
  PlayIcon,
  HeartGiftIcon,
} from "@/components/ui/icons";

const FP_KEY = "wgp.fingerprint";
const NAME_KEY = "wgp.name";

function readOrMintFingerprint(): string {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(FP_KEY);
  if (existing) return existing;
  const fresh = crypto.randomUUID();
  window.localStorage.setItem(FP_KEY, fresh);
  return fresh;
}

function isAllowedMime(t: string): t is AllowedMime {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(t);
}

interface Props {
  lang: Lang;
  eventSlug: string;
  maxPerGuest: number;
  primaryColor: string | null;
  tableLabel: string | null;
}

function videoDurationOk(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      const ok = v.duration <= MAX_VIDEO_DURATION_SEC + 0.5;
      URL.revokeObjectURL(url);
      resolve(ok);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(true); // err on the side of trying — server will reject if size is wrong
    };
    v.src = url;
  });
}

export function UploadClient({
  lang,
  eventSlug,
  maxPerGuest,
  primaryColor,
  tableLabel,
}: Props) {
  const t = DICT[lang];
  const primaryButtonClass = primaryColor
    ? "flex-1 rounded-xl px-4 py-3 text-white text-sm font-medium shadow-soft hover:brightness-90 disabled:opacity-60 disabled:cursor-not-allowed transition"
    : "flex-1 rounded-xl bg-blush-500 px-4 py-3 text-white text-sm font-medium shadow-soft hover:bg-blush-600 disabled:opacity-60 disabled:cursor-not-allowed transition";
  const primaryButtonStyle = primaryColor
    ? { backgroundColor: primaryColor }
    : undefined;
  const [fingerprint, setFingerprint] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [messageMode, setMessageMode] = useState<"text" | "voice">("text");
  const [voiceSent, setVoiceSent] = useState(0);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFingerprint(readOrMintFingerprint());
    setName(window.localStorage.getItem(NAME_KEY) ?? "");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (name) window.localStorage.setItem(NAME_KEY, name);
  }, [name]);

  const doneCount = items.filter((i) => i.status === "done").length;
  const failedCount = items.filter((i) => i.status === "failed").length;
  const allFinished =
    items.length > 0 &&
    items.every((i) => i.status === "done" || i.status === "failed");

  function patchItem(id: string, patch: Partial<UploadItem>) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";

    const accepted: UploadItem[] = [];
    const rejected: string[] = [];

    for (const file of files) {
      if (!isAllowedMime(file.type)) {
        rejected.push(t.errUnsupported(file.name));
        continue;
      }
      if (file.size > maxSizeFor(file.type)) {
        rejected.push(t.errOverSize(file.name));
        continue;
      }
      if (isVideoMime(file.type)) {
        const ok = await videoDurationOk(file);
        if (!ok) {
          rejected.push(t.errVideoTooLong(file.name));
          continue;
        }
      }
      accepted.push({
        id: crypto.randomUUID(),
        file,
        status: "pending",
        progress: 0,
      });
    }

    if (accepted.length > MAX_FILES_PER_REQUEST) {
      rejected.push(t.errTruncated(MAX_FILES_PER_REQUEST));
      accepted.length = MAX_FILES_PER_REQUEST;
    }

    setBatchError(rejected.length ? rejected.join(" · ") : null);
    setItems(accepted);
  }

  async function handleUpload() {
    if (!items.length || !fingerprint) return;
    setIsUploading(true);
    setBatchError(null);
    try {
      await uploadGuestPhotos({
        eventSlug,
        clientFingerprint: fingerprint,
        displayName: name || null,
        message: message || null,
        tableLabel: tableLabel ?? null,
        items,
        onItemChange: patchItem,
      });
      // Clear the message after a successful send so a second batch
      // doesn't accidentally re-post it.
      setMessage("");
    } catch (err) {
      setBatchError((err as Error).message);
    } finally {
      setIsUploading(false);
    }
  }

  function reset() {
    setItems([]);
    setBatchError(null);
    fileInputRef.current?.click();
  }

  if (allFinished) {
    return (
      <ThankYou
        lang={lang}
        doneCount={doneCount}
        failedCount={failedCount}
        primaryColor={primaryColor}
        onAddMore={reset}
      />
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-soft p-6 sm:p-8 space-y-5">
      <label className="block">
        <span className="text-sm text-ink-700 font-medium">
          {t.yourName}{" "}
          <span className="text-ink-500 font-normal">{t.optional}</span>
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.yourNamePlaceholder}
          maxLength={64}
          disabled={isUploading}
          className="mt-1.5 w-full rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 text-[15px] outline-none focus:border-blush-500 focus:bg-white transition"
        />
      </label>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm text-ink-700 font-medium">
            {t.messageLabel}{" "}
            <span className="text-ink-500 font-normal">{t.optional}</span>
          </span>
          <div
            className="inline-flex rounded-lg bg-cream-100 p-0.5 text-[11px]"
            role="tablist"
          >
            <button
              type="button"
              onClick={() => setMessageMode("text")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md transition ${
                messageMode === "text" ? "bg-white shadow-sm text-ink-900" : "text-ink-500"
              }`}
              role="tab"
              aria-selected={messageMode === "text"}
            >
              <PencilIcon className="h-3.5 w-3.5" />
              {lang === "zh-Hant" ? "文字" : "Text"}
            </button>
            <button
              type="button"
              onClick={() => setMessageMode("voice")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md transition ${
                messageMode === "voice" ? "bg-white shadow-sm text-ink-900" : "text-ink-500"
              }`}
              role="tab"
              aria-selected={messageMode === "voice"}
            >
              <MicIcon className="h-3.5 w-3.5" />
              {lang === "zh-Hant" ? "語音" : "Voice"}
            </button>
          </div>
        </div>

        {messageMode === "text" ? (
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t.messagePlaceholder}
            maxLength={500}
            rows={2}
            disabled={isUploading}
            className="w-full rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 text-[15px] outline-none focus:border-blush-500 focus:bg-white transition resize-none"
          />
        ) : (
          <AudioRecorder
            lang={lang}
            eventSlug={eventSlug}
            clientFingerprint={fingerprint}
            displayName={name || null}
            primaryColor={primaryColor}
            onSent={() => setVoiceSent((n) => n + 1)}
          />
        )}
        {messageMode === "voice" && voiceSent > 0 ? (
          <p className="mt-2 text-[11px] text-sage-600 text-center">
            {lang === "zh-Hant"
              ? `已送出 ${voiceSent} 段語音留言`
              : `${voiceSent} voice message${voiceSent === 1 ? "" : "s"} sent`}
          </p>
        ) : null}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm"
        multiple
        capture="environment"
        onChange={handleFileSelect}
        disabled={isUploading}
        className="hidden"
        id="wgp-file-input"
      />

      {items.length === 0 ? (
        <label
          htmlFor="wgp-file-input"
          className="block cursor-pointer rounded-2xl border-2 border-dashed border-blush-400 bg-blush-400/10 px-6 py-10 text-center transition hover:bg-blush-400/15"
        >
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blush-400/15 text-blush-600">
            <CameraIcon className="h-6 w-6" />
          </div>
          <div className="font-serif text-lg text-ink-900">
            {t.choosePhotos}
          </div>
          <div className="text-xs text-ink-500 mt-1">
            {t.chooseHelp(MAX_FILES_PER_REQUEST)}
          </div>
        </label>
      ) : (
        <>
          <FileList items={items} />
          <div className="flex gap-2">
            {!isUploading ? (
              <label
                htmlFor="wgp-file-input"
                className="flex-1 cursor-pointer rounded-xl bg-cream-100 px-4 py-3 text-center text-sm text-ink-700 hover:bg-cream-200 transition"
              >
                {t.changePhotos}
              </label>
            ) : null}
            <button
              type="button"
              onClick={handleUpload}
              disabled={isUploading}
              className={primaryButtonClass}
              style={primaryButtonStyle}
            >
              {isUploading
                ? t.sending(doneCount, items.length)
                : t.send(items.length)}
            </button>
          </div>
        </>
      )}

      {batchError ? (
        <div className="rounded-xl bg-blush-400/15 px-4 py-3 text-sm text-blush-600">
          {batchError}
        </div>
      ) : null}

      <p className="text-[11px] text-ink-500 text-center leading-relaxed">
        {t.privacyNote(maxPerGuest)}
      </p>
    </div>
  );
}

function FileList({ items }: { items: UploadItem[] }) {
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li
          key={it.id}
          className="flex items-center gap-3 rounded-xl border border-cream-200 p-2.5"
        >
          <Thumb file={it.file} />
          <div className="flex-1 min-w-0">
            <div className="truncate text-sm text-ink-900">{it.file.name}</div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-cream-100 overflow-hidden">
              <div
                className={`h-full transition-all ${
                  it.status === "failed"
                    ? "bg-blush-600"
                    : it.status === "done"
                      ? "bg-sage-500"
                      : "bg-blush-500"
                }`}
                style={{ width: `${it.status === "done" ? 100 : it.progress}%` }}
              />
            </div>
            {it.status === "failed" && it.error ? (
              <div className="mt-1 text-[11px] text-blush-600 truncate">
                {it.error}
              </div>
            ) : null}
          </div>
          <StatusBadge status={it.status} />
        </li>
      ))}
    </ul>
  );
}

function Thumb({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);
  const isVideo = isVideoMime(file.type);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return (
    <div className="relative h-12 w-12 shrink-0 rounded-lg bg-cream-100 overflow-hidden">
      {url && !isVideo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : null}
      {url && isVideo ? (
        <video src={url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
      ) : null}
      {isVideo ? (
        <span className="absolute inset-0 flex items-center justify-center bg-ink-900/30 text-white">
          <PlayIcon className="h-4 w-4" />
        </span>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: UploadItem["status"] }) {
  const label =
    status === "done"
      ? "✓"
      : status === "failed"
        ? "!"
        : status === "uploading"
          ? "…"
          : "•";
  const cls =
    status === "done"
      ? "text-sage-600"
      : status === "failed"
        ? "text-blush-600"
        : "text-ink-500";
  return (
    <span className={`text-sm ${cls}`} aria-label={status}>
      {label}
    </span>
  );
}

const CONFETTI_COLORS = [
  "#D9989E", "#E8B4B8", "#C77B82",
  "#8AA088", "#6E8A6C",
  "#F5EFE6", "#EADFD0",
];

function Confetti({ count = 32 }: { count?: number }) {
  // Deterministic-ish per-render layout — random is fine because the
  // component only renders once on the success transition.
  const pieces = Array.from({ length: count }, (_, i) => {
    const left = Math.random() * 100;
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const delay = Math.random() * 600;
    const duration = 1800 + Math.random() * 1200;
    const drift = -30 + Math.random() * 60;
    return { left, color, delay, duration, drift };
  });
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden z-50">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}ms`,
            animationDuration: `${p.duration}ms`,
            transform: `translate(${p.drift}px, 0)`,
          }}
        />
      ))}
    </div>
  );
}

function ThankYou({
  lang,
  doneCount,
  failedCount,
  primaryColor,
  onAddMore,
}: {
  lang: Lang;
  doneCount: number;
  failedCount: number;
  primaryColor: string | null;
  onAddMore: () => void;
}) {
  const t = DICT[lang];
  const showConfetti = doneCount > 0 && failedCount === 0;
  return (
    <>
      {showConfetti ? <Confetti /> : null}
      <div className="bg-white rounded-3xl shadow-soft p-8 text-center animate-[pop_500ms_cubic-bezier(0.2,0.8,0.4,1)_both]">
        <div
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full animate-[pop_700ms_cubic-bezier(0.2,0.8,0.4,1)_both]"
          style={
            primaryColor
              ? { backgroundColor: `${primaryColor}1f`, color: primaryColor }
              : undefined
          }
        >
          <HeartGiftIcon
            className={`h-8 w-8 ${primaryColor ? "" : "text-blush-500"}`}
          />
        </div>
        <h2 className="font-serif text-2xl text-ink-900 mb-2">{t.thanksTitle}</h2>
        <p className="text-ink-700 text-sm leading-relaxed mb-6">
          {t.thanksBody(doneCount)}
          {failedCount > 0 ? t.thanksFailed(failedCount) : ""}
        </p>
        <button
          type="button"
          onClick={onAddMore}
          className={
            primaryColor
              ? "rounded-xl px-5 py-3 text-white text-sm font-medium shadow-soft hover:brightness-90 transition"
              : "rounded-xl bg-blush-500 px-5 py-3 text-white text-sm font-medium shadow-soft hover:bg-blush-600 transition"
          }
          style={primaryColor ? { backgroundColor: primaryColor } : undefined}
        >
          {t.addMore}
        </button>
      </div>
    </>
  );
}
