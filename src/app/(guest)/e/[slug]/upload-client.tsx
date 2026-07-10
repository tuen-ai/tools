"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
import {
  queueAdd,
  queueList,
  queueRemove,
} from "@/lib/upload/offline-queue";
import { DICT, lookupUploadError, type Lang } from "@/lib/i18n";
import { AudioRecorder, type VoiceClip } from "@/components/guest/audio-recorder";
import {
  CameraIcon,
  MicIcon,
  PencilIcon,
  PlayIcon,
  HeartFilledIcon,
  CheckIcon,
  TrashIcon,
  StarFilledIcon,
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
  /** Photo-challenge prompts the couple set up; empty = feature hidden. */
  challenges: { id: string; prompt: string }[];
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
  challenges,
}: Props) {
  const t = DICT[lang];
  // One button shape everywhere — the vintage letterpress .btn-candy. A
  // custom theme colour just overrides the fill (and drops the burgundy 3D
  // edge) via inline style, instead of switching to a candy-era pill.
  const primaryButtonClass =
    "flex-1 btn-candy px-4 py-3 text-sm disabled:opacity-60 disabled:cursor-not-allowed";
  const primaryButtonStyle = primaryColor
    ? { backgroundColor: primaryColor, boxShadow: "none" }
    : undefined;
  const [fingerprint, setFingerprint] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"photo" | "text" | "voice">(
    "photo",
  );
  const [sentTexts, setSentTexts] = useState<{ id: string; body: string }[]>([]);
  const [sendingText, setSendingText] = useState(false);
  // Selected photo-challenge (applies to the whole batch; tap to toggle).
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [voiceClips, setVoiceClips] = useState<VoiceClip[]>([]);
  const [deletingClipId, setDeletingClipId] = useState<string | null>(null);
  // Mirror voiceClips into a ref so the unmount cleanup can revoke the
  // LATEST set of blob URLs, not the initial empty array (which is what a
  // plain empty-deps useEffect would close over).
  const voiceClipsRef = useRef<VoiceClip[]>(voiceClips);
  useEffect(() => {
    voiceClipsRef.current = voiceClips;
  }, [voiceClips]);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  // Offline queue: files persisted in IndexedDB awaiting network.
  const [queuedCount, setQueuedCount] = useState(0);
  const [draining, setDraining] = useState(false);
  const drainingRef = useRef(false);
  // The guest's previously-sent uploads ("did it work?" reassurance strip).
  const [myUploads, setMyUploads] = useState<{
    count: number;
    items: { id: string; kind: "image" | "video"; url: string | null }[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // The "更換相片" label replaces the current selection; the "+ 新增相片"
  // tile appends to it. Both point at the same file input, so we stash the
  // intent on a ref and read it when the change event fires.
  const appendModeRef = useRef(false);

  useEffect(() => {
    setFingerprint(readOrMintFingerprint());
    setName(window.localStorage.getItem(NAME_KEY) ?? "");
  }, []);

  const refreshMyUploads = useCallback(
    async (fp: string) => {
      if (!fp) return;
      // Retry a couple of times on a transient failure — venue Wi-Fi drops
      // one request and the "you've shared N" strip would otherwise stay
      // blank on a returning guest even though their uploads exist.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch("/api/media/mine", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventSlug, clientFingerprint: fp }),
          });
          if (res.ok) {
            setMyUploads((await res.json()) as NonNullable<typeof myUploads>);
            return;
          }
          if (res.status !== 429 && res.status < 500) return; // won't fix on retry
        } catch {
          // network blip — fall through to retry
        }
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    },
    [eventSlug],
  );

  // Reload the guest's own text + voice messages so they persist across
  // page loads (keyed on the device fingerprint), same as the photo strip.
  const refreshMyMessages = useCallback(
    async (fp: string) => {
      if (!fp) return;
      try {
        const res = await fetch("/api/messages/mine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventSlug, clientFingerprint: fp }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          texts: { id: string; body: string }[];
          voice: { id: string; url: string | null }[];
        };
        setSentTexts(data.texts);
        setVoiceClips(
          data.voice
            .filter((v) => v.url)
            .map((v) => ({
              messageId: v.id,
              audioUrl: v.url as string,
              durationSec: null,
            })),
        );
      } catch {
        // best-effort
      }
    },
    [eventSlug],
  );

  // Returning guests see their earlier uploads + messages as soon as the
  // fingerprint hydrates, and again whenever they come back to the tab.
  useEffect(() => {
    if (fingerprint) {
      void refreshMyUploads(fingerprint);
      void refreshMyMessages(fingerprint);
    }
  }, [fingerprint, refreshMyUploads, refreshMyMessages]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible" && fingerprint) {
        void refreshMyUploads(fingerprint);
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fingerprint, refreshMyUploads]);

  // Drain the offline queue: re-upload files saved in IndexedDB while the
  // device was offline. Runs on mount (resume after a tab close), when the
  // browser reports connectivity back, and when the tab becomes visible.
  const drainQueue = useCallback(
    async (fp: string) => {
      if (drainingRef.current || !fp || !navigator.onLine) return;
      drainingRef.current = true;
      try {
        const stored = await queueList(eventSlug);
        setQueuedCount(stored.length);
        if (!stored.length) return;
        setDraining(true);
        const qItems: UploadItem[] = stored.map((s) => ({
          id: s.id,
          file: new File([s.blob], s.name, { type: s.type }),
          status: "pending",
          progress: 0,
        }));
        await uploadGuestPhotos({
          eventSlug,
          clientFingerprint: fp,
          displayName: null,
          message: null,
          tableLabel: stored[0]?.tableLabel ?? null,
          challengeId: stored[0]?.challengeId ?? null,
          items: qItems,
          onItemChange: (id, patch) => {
            if (patch.status === "done") {
              void queueRemove(id);
              setQueuedCount((q) => Math.max(0, q - 1));
            }
          },
        });
        const remaining = await queueList(eventSlug);
        setQueuedCount(remaining.length);
        if (remaining.length === 0) void refreshMyUploads(fp);
      } catch {
        // Still offline / sign failed — the queue stays put for next time.
      } finally {
        setDraining(false);
        drainingRef.current = false;
      }
    },
    [eventSlug, refreshMyUploads],
  );

  useEffect(() => {
    if (fingerprint) void drainQueue(fingerprint);
  }, [fingerprint, drainQueue]);

  useEffect(() => {
    function onOnline() {
      if (fingerprint) void drainQueue(fingerprint);
    }
    function onVis() {
      if (document.visibilityState === "visible" && fingerprint) {
        void drainQueue(fingerprint);
      }
    }
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [fingerprint, drainQueue]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (name) window.localStorage.setItem(NAME_KEY, name);
  }, [name]);

  // Revoke voice-clip blob URLs on unmount so we don't leak them across
  // full navigations. Reads from the ref above so we see the LATEST clips,
  // not the [] captured by a plain empty-deps closure. (Per-clip revoke
  // happens synchronously inside the delete handler.)
  useEffect(() => {
    return () => {
      voiceClipsRef.current.forEach((c) => URL.revokeObjectURL(c.audioUrl));
    };
  }, []);

  // Shared guest-message delete (text or voice), authenticated by
  // (eventSlug, fingerprint).
  async function deleteGuestMessage(id: string): Promise<boolean> {
    const res = await fetch(`/api/messages/${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventSlug, clientFingerprint: fingerprint }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `delete_failed_${res.status}`);
    }
    return true;
  }

  async function deleteVoiceClip(clip: VoiceClip) {
    if (deletingClipId) return;
    if (!window.confirm(t.voiceClipDeleteConfirm)) return;
    setDeletingClipId(clip.messageId);
    try {
      await deleteGuestMessage(clip.messageId);
      URL.revokeObjectURL(clip.audioUrl);
      setVoiceClips((prev) => prev.filter((c) => c.messageId !== clip.messageId));
    } catch (err) {
      setBatchError(lookupUploadError(t, (err as Error).message));
    } finally {
      setDeletingClipId(null);
    }
  }

  async function deleteTextMessage(id: string) {
    if (deletingClipId) return;
    if (!window.confirm(t.myUploadDeleteConfirm)) return;
    setDeletingClipId(id);
    try {
      await deleteGuestMessage(id);
      setSentTexts((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setBatchError(lookupUploadError(t, (err as Error).message));
    } finally {
      setDeletingClipId(null);
    }
  }

  // Text messages send standalone (like voice) — a guest can leave a
  // well-wish without also uploading photos, and see it echoed back.
  async function sendTextMessage() {
    const body = message.trim();
    if (!body || sendingText || !fingerprint) return;
    setSendingText(true);
    setBatchError(null);
    try {
      const res = await fetch("/api/messages/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventSlug,
          clientFingerprint: fingerprint,
          displayName: name || null,
          body,
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `send_failed_${res.status}`);
      }
      const { id } = (await res.json()) as { id: string };
      setSentTexts((prev) => [...prev, { id, body }]);
      setMessage("");
    } catch (err) {
      setBatchError(lookupUploadError(t, (err as Error).message));
    } finally {
      setSendingText(false);
    }
  }

  async function deleteMyUpload(mediaId: string) {
    if (!window.confirm(t.myUploadDeleteConfirm)) return;
    // Optimistic: drop it from the strip immediately.
    setMyUploads((prev) =>
      prev
        ? {
            count: Math.max(0, prev.count - 1),
            items: prev.items.filter((m) => m.id !== mediaId),
          }
        : prev,
    );
    try {
      await fetch(`/api/media/${encodeURIComponent(mediaId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventSlug, clientFingerprint: fingerprint }),
      });
    } catch {
      // Best-effort — the strip already updated; a refresh reconciles.
    }
  }

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

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  // Warn before navigating away mid-upload. Uploads PUT straight to storage
  // from this tab; switching back to the camera app on flaky venue Wi-Fi
  // would silently kill the in-flight transfers.
  useEffect(() => {
    if (!isUploading) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isUploading]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const append = appendModeRef.current;
    appendModeRef.current = false;

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

    // When appending we keep existing pending/uploading/failed items so the
    // guest doesn't lose their picks. Done items drop out — they've already
    // been sent and shouldn't ride along on the next batch.
    const base = append ? items.filter((i) => i.status !== "done") : [];
    let merged = [...base, ...accepted];
    if (merged.length > MAX_FILES_PER_REQUEST) {
      rejected.push(t.errTruncated(MAX_FILES_PER_REQUEST));
      merged = merged.slice(0, MAX_FILES_PER_REQUEST);
    }

    setBatchError(rejected.length ? rejected.join(" · ") : null);
    setItems(merged);
  }

  // Stash not-yet-uploaded items into the offline queue (IndexedDB) so
  // they survive tab closes and auto-send when the network returns.
  async function stashOffline(list: UploadItem[], failedIds: Set<string>) {
    const toQueue = list.filter((i) => failedIds.has(i.id));
    if (!toQueue.length) return;
    const ok = await queueAdd(
      toQueue.map((i) => ({
        id: i.id,
        eventSlug,
        blob: i.file,
        name: i.file.name,
        type: i.file.type,
        tableLabel: tableLabel ?? null,
        challengeId,
        addedAt: Date.now(),
      })),
    );
    if (ok) {
      setQueuedCount((q) => q + toQueue.length);
      // Drop the queued items from the visible list — the banner owns them
      // now, and a guest shouldn't see the same file in two places.
      setItems((prev) => prev.filter((i) => !failedIds.has(i.id)));
    }
  }

  // Core upload driver, shared by first send and retry-failed. Takes the
  // list explicitly (retry mutates state first, which isn't visible to a
  // closure over `items`).
  async function runUpload(list: UploadItem[]) {
    if (!list.length || !fingerprint) return;
    setIsUploading(true);
    setBatchError(null);
    // Track final statuses locally — patchItem's setState isn't readable
    // synchronously after the await.
    const statusMap = new Map(list.map((i) => [i.id, i.status]));
    try {
      await uploadGuestPhotos({
        eventSlug,
        clientFingerprint: fingerprint,
        displayName: name || null,
        // Text notes now send standalone (see sendTextMessage), so they no
        // longer ride with the photo batch — decoupled from voice-parity.
        message: null,
        tableLabel: tableLabel ?? null,
        challengeId,
        items: list,
        onItemChange: (id, patch) => {
          if (patch.status) statusMap.set(id, patch.status);
          patchItem(id, patch);
        },
      });
      // Refresh the reassurance strip so the new photos show up in it.
      void refreshMyUploads(fingerprint);
      // Anything that failed while the device is offline goes to the queue
      // for automatic resend. Online failures keep the manual retry flow
      // (they're usually validation, which a retry won't fix silently).
      if (!navigator.onLine) {
        const failedIds = new Set(
          [...statusMap].filter(([, s]) => s === "failed").map(([id]) => id),
        );
        await stashOffline(list, failedIds);
      }
    } catch (err) {
      // Sign-step failure: nothing uploaded. If we're offline, save the
      // whole batch for auto-resend instead of surfacing an error.
      if (!navigator.onLine) {
        await stashOffline(list, new Set(list.map((i) => i.id)));
      } else {
        setBatchError(lookupUploadError(t, (err as Error).message));
      }
    } finally {
      setIsUploading(false);
    }
  }

  function handleUpload() {
    void runUpload(items);
  }

  // Keep the failed items (their File objects are still in state), reset
  // them to pending, and re-run just those — so a guest doesn't have to
  // re-find the failed photos in a huge camera roll.
  function retryFailed() {
    const retry = items
      .filter((i) => i.status === "failed")
      .map((i) => ({
        ...i,
        status: "pending" as const,
        progress: 0,
        error: undefined,
      }));
    if (!retry.length) return;
    setItems(retry);
    void runUpload(retry);
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
        onRetryFailed={retryFailed}
      />
    );
  }

  const tabs = [
    { key: "photo" as const, label: t.tabPhoto, Icon: CameraIcon },
    { key: "text" as const, label: t.msgModeText, Icon: PencilIcon },
    { key: "voice" as const, label: t.msgModeVoice, Icon: MicIcon },
  ];

  return (
    <div className="frame-vintage shadow-soft p-6 sm:p-8 space-y-5">
      <label className="block">
        <span className="text-sm text-ink-700 font-medium">
          {t.yourName}{" "}
          <span className="text-ink-700 font-normal">{t.optional}</span>
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={64}
          disabled={isUploading}
          className="mt-1.5 w-full rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 text-base outline-none focus:border-blush-500 focus:bg-white transition"
        />
      </label>

      {/* Photo / Text / Voice tabs. */}
      <div>
        <div
          className="grid grid-cols-3 rounded-lg bg-cream-100 p-0.5 text-xs"
          role="tablist"
        >
          {tabs.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              role="tab"
              aria-selected={activeTab === key}
              className={`inline-flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-md transition ${
                activeTab === key
                  ? "bg-white shadow-sm text-ink-900 font-medium"
                  : "text-ink-700"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Photo / Video tab ─────────────────────────────────── */}
        {activeTab === "photo" ? (
          <div className="space-y-4 mt-4">
            {myUploads && myUploads.count > 0 ? (
              <div className="rounded-xl bg-sage-500/10 p-3">
                <p className="text-xs font-medium text-sage-700 mb-2">
                  {t.myUploadsHeading(myUploads.count)}
                </p>
                <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                  {myUploads.items.map((m) => (
                    <div key={m.id} className="relative shrink-0">
                      {m.kind === "image" && m.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.url}
                          alt=""
                          loading="lazy"
                          className="h-14 w-14 rounded-lg object-cover"
                        />
                      ) : (
                        <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-ink-900/80 text-white">
                          <PlayIcon className="h-4 w-4" />
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteMyUpload(m.id)}
                        aria-label={t.removeFile}
                        className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink-900 text-white shadow"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.4}
                          strokeLinecap="round"
                          className="h-3 w-3"
                          aria-hidden="true"
                        >
                          <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {challenges.length > 0 ? (
              <div>
                <span className="text-sm text-ink-700 font-medium">
                  {t.challengesLabel}{" "}
                  <span className="text-ink-700 font-normal">{t.optional}</span>
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {challenges.map((c) => {
                    const active = challengeId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={isUploading}
                        aria-pressed={active}
                        onClick={() =>
                          setChallengeId((cur) => (cur === c.id ? null : c.id))
                        }
                        className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2.5 text-sm transition ${
                          active
                            ? "border-blush-400 bg-blush-500/15 text-blush-700 font-medium"
                            : "border-cream-200 bg-cream-50 text-ink-700 hover:border-blush-400"
                        }`}
                      >
                        <StarFilledIcon
                          className={`h-3 w-3 ${active ? "" : "opacity-40"}`}
                        />
                        {c.prompt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <input
              ref={fileInputRef}
              type="file"
              // No image/heic|heif here: iOS Safari then transcodes HEIC →
              // JPEG on selection. No `capture`: it forces the camera on
              // Android and hides the photo library. Server allowlist still
              // accepts HEIC for Android file managers.
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
              multiple
              onChange={handleFileSelect}
              disabled={isUploading}
              className="hidden"
              id="wgp-file-input"
            />

            {items.length === 0 ? (
              <label
                htmlFor="wgp-file-input"
                className="block cursor-pointer rounded-lg border-2 border-dashed border-sage-600 bg-sage-500/10 px-6 py-10 text-center transition hover:bg-sage-500/15"
              >
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white text-sage-700 shadow-soft animate-[bob_2.6s_ease-in-out_infinite]">
                  <CameraIcon className="h-7 w-7" />
                </div>
                <div className="font-serif text-lg text-ink-900">
                  {t.choosePhotos}
                </div>
                <div className="text-xs text-ink-700 mt-1">
                  {t.chooseHelp(MAX_FILES_PER_REQUEST)}
                </div>
              </label>
            ) : (
              <>
                <FileList
                  items={items}
                  lang={lang}
                  canRemove={!isUploading}
                  onRemove={removeItem}
                />
                {!isUploading && items.length < MAX_FILES_PER_REQUEST ? (
                  <label
                    htmlFor="wgp-file-input"
                    onClick={() => {
                      appendModeRef.current = true;
                    }}
                    className="flex items-center justify-center gap-2 cursor-pointer rounded-xl border border-dashed border-blush-400 bg-blush-400/5 px-4 py-2.5 text-sm font-medium text-blush-700 hover:bg-blush-400/10 transition"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                      aria-hidden="true"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    {t.addMorePhotos}
                  </label>
                ) : null}
                <div className="flex gap-2">
                  {!isUploading ? (
                    <label
                      htmlFor="wgp-file-input"
                      onClick={() => {
                        appendModeRef.current = false;
                      }}
                      className="flex-1 cursor-pointer btn-soft px-4 py-3 text-center text-sm"
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
                {isUploading ? (
                  <p className="text-xs text-ink-700 text-center">
                    {t.uploadingKeepOpen}
                  </p>
                ) : null}
              </>
            )}
          </div>
        ) : activeTab === "text" ? (
          /* ── Text tab ────────────────────────────────────────── */
          <div className="space-y-3 mt-4">
            {sentTexts.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-sage-700 mb-2">
                  {t.sentMessagesHeading(sentTexts.length)}
                </p>
                <ul className="space-y-2">
                  {sentTexts.map((m) => (
                    <li
                      key={m.id}
                      className="rounded-xl border border-cream-200 bg-cream-50 px-3 py-2"
                    >
                      <p className="text-sm text-ink-900 whitespace-pre-wrap break-words">
                        {m.body}
                      </p>
                      <button
                        type="button"
                        onClick={() => deleteTextMessage(m.id)}
                        disabled={deletingClipId === m.id}
                        className="mt-1 inline-flex items-center gap-1 py-1 text-xs text-blush-700 hover:text-blush-700/80 disabled:opacity-60"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                        {deletingClipId === m.id
                          ? t.voiceClipDeleting
                          : t.removeFile}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t.messagePlaceholder}
              maxLength={500}
              rows={2}
              disabled={sendingText}
              className="w-full rounded-xl border border-cream-200 bg-cream-50 px-4 py-3 text-base outline-none focus:border-blush-500 focus:bg-white transition resize-none"
            />
            {message.trim() ? (
              <button
                type="button"
                onClick={sendTextMessage}
                disabled={sendingText}
                className="w-full btn-candy px-4 py-3 text-sm"
                style={primaryButtonStyle}
              >
                {sendingText ? t.textSending : t.textSend}
              </button>
            ) : null}
          </div>
        ) : (
          /* ── Voice tab ───────────────────────────────────────── */
          <div className="space-y-3 mt-4">
            {voiceClips.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-sage-700 mb-2">
                  {t.voiceClipHeading(voiceClips.length)}
                </p>
                <ul className="space-y-2">
                  {voiceClips.map((clip) => (
                    <li
                      key={clip.messageId}
                      className="rounded-xl border border-cream-200 bg-cream-50 p-3"
                    >
                      <div className="flex items-center justify-between mb-2 text-xs text-ink-700">
                        <span>
                          {clip.durationSec != null
                            ? t.voiceClipDuration(clip.durationSec)
                            : t.msgModeVoice}
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteVoiceClip(clip)}
                          disabled={deletingClipId === clip.messageId}
                          className="inline-flex items-center gap-1 py-1.5 text-blush-700 hover:text-blush-700/80 disabled:opacity-60"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                          {deletingClipId === clip.messageId
                            ? t.voiceClipDeleting
                            : t.voiceClipDelete}
                        </button>
                      </div>
                      <audio
                        src={clip.audioUrl}
                        controls
                        preload="metadata"
                        className="w-full"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <AudioRecorder
              lang={lang}
              eventSlug={eventSlug}
              clientFingerprint={fingerprint}
              displayName={name || null}
              primaryColor={primaryColor}
              hasExistingClips={voiceClips.length > 0}
              onSent={(clip) => setVoiceClips((prev) => [...prev, clip])}
            />
          </div>
        )}
      </div>

      {queuedCount > 0 ? (
        <div className="rounded-xl bg-butter-soft px-4 py-3 text-sm text-butter-deep">
          {draining
            ? t.offlineDraining(queuedCount)
            : t.offlinePending(queuedCount)}
        </div>
      ) : null}

      {batchError ? (
        <div className="rounded-xl bg-blush-400/15 px-4 py-3 text-sm text-blush-700">
          {batchError}
        </div>
      ) : null}

      <p className="text-xs text-ink-700 text-center leading-relaxed">
        {t.privacyNote(maxPerGuest)}
      </p>
    </div>
  );
}

function FileList({
  items,
  lang,
  canRemove,
  onRemove,
}: {
  items: UploadItem[];
  lang: Lang;
  canRemove: boolean;
  onRemove: (id: string) => void;
}) {
  const t = DICT[lang];
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li
          key={it.id}
          className="flex items-center gap-3 rounded-xl border border-cream-200 p-2.5"
        >
          <Thumb file={it.file} />
          <div className="flex-1 min-w-0">
            {/* The raw filename (IMG_4302.jpeg) carries no meaning — show a
                friendly kind + size instead. */}
            <div className="truncate text-sm text-ink-900">
              {t.fileMeta(
                isVideoMime(it.file.type),
                (it.file.size / 1024 / 1024).toFixed(1),
              )}
            </div>
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
              <div className="mt-1 text-xs text-blush-700">
                {lookupUploadError(t, it.error)}
              </div>
            ) : null}
          </div>
          {/* Per-file remove — so a guest who picked one wrong photo doesn't
              have to re-pick the whole batch. Hidden while uploading. */}
          {canRemove && it.status !== "done" ? (
            <button
              type="button"
              onClick={() => onRemove(it.id)}
              aria-label={t.removeFile}
              className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full text-ink-500 hover:text-blush-700 hover:bg-blush-500/10 transition"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          ) : (
            <StatusBadge status={it.status} />
          )}
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
  // Done uses the line-icon check (consistent with the rest of the app and
  // stable across OSes, unlike a ✓ glyph); the other states are small
  // colour-coded dots — uploading pulses, pending is muted, failed is a
  // solid raspberry dot.
  if (status === "done") {
    return (
      <span role="img" aria-label={status} className="text-sage-700">
        <CheckIcon className="h-4 w-4" />
      </span>
    );
  }
  const dotCls =
    status === "failed"
      ? "bg-blush-700"
      : status === "uploading"
        ? "bg-blush-500 animate-pulse"
        : "bg-ink-500";
  return (
    <span
      role="img"
      aria-label={status}
      className={`inline-block h-2.5 w-2.5 rounded-full ${dotCls}`}
    />
  );
}

// Vintage confetti — burgundy, mustard, teal, terracotta, plum, parchment.
const CONFETTI_COLORS = [
  "#7C3030", "#C98A8A", "#D9A441",
  "#3E6E64", "#C97F5C", "#B79AB4", "#EFE4CD",
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
  onRetryFailed,
}: {
  lang: Lang;
  doneCount: number;
  failedCount: number;
  primaryColor: string | null;
  onAddMore: () => void;
  onRetryFailed: () => void;
}) {
  const t = DICT[lang];
  const showConfetti = doneCount > 0 && failedCount === 0;
  return (
    <>
      {showConfetti ? <Confetti /> : null}
      <div className="frame-vintage shadow-soft p-8 text-center animate-[pop_500ms_cubic-bezier(0.2,0.8,0.4,1)_both]">
        <div
          className="mx-auto mb-4 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full animate-[bob_2.6s_ease-in-out_infinite]"
          style={
            primaryColor
              ? { backgroundColor: `${primaryColor}1f`, color: primaryColor }
              : undefined
          }
        >
          <HeartFilledIcon
            className={`h-9 w-9 ${primaryColor ? "" : "text-blush-500"}`}
          />
        </div>
        <h2 className="font-serif text-2xl text-ink-900 mb-2">{t.thanksTitle}</h2>
        <p className="text-ink-700 text-sm leading-relaxed mb-6">
          {t.thanksBody(doneCount)}
          {failedCount > 0 ? t.thanksFailed(failedCount) : ""}
        </p>
        <div className="flex flex-col gap-2 items-center">
          {failedCount > 0 ? (
            <button
              type="button"
              onClick={onRetryFailed}
              className="btn-soft px-5 py-3 text-sm"
            >
              {t.retryFailed(failedCount)}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onAddMore}
            className="btn-candy px-5 py-3 text-sm"
            style={
              primaryColor
                ? { backgroundColor: primaryColor, boxShadow: "none" }
                : undefined
            }
          >
            {t.addMore}
          </button>
        </div>
      </div>
    </>
  );
}
