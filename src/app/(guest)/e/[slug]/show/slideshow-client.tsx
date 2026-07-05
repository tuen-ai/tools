"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { DICT, type Lang } from "@/lib/i18n";
import { SparkleIcon } from "@/components/ui/icons";

export interface Slide {
  id: string;
  url: string;
  kind: "image" | "video";
  createdAt: string;
}

interface SlideResponse {
  slides: Slide[];
}

interface Props {
  lang: Lang;
  eventSlug: string;
  coupleNames: string;
  initialSlides: Slide[];
  /** "slideshow" = one photo at a time with Ken Burns; "wall" = live
   *  masonry grid that surfaces many new arrivals at once. The wall is
   *  the stronger in-room upload nudge during reception surges. */
  mode?: "slideshow" | "wall";
}

const SLIDE_MS = 6000;          // hold time per image
const VIDEO_MAX_MS = 32000;     // safety cap for video slides
const POLL_INTERVAL_MS = 8000;  // how often we ask for new slides
const NEW_TOAST_MS = 4500;      // "New from a guest" banner duration
const IDLE_CURSOR_MS = 3000;    // hide cursor after this idle time
const WALL_MAX_TILES = 80;      // cap DOM size on long receptions
const WALL_FRESH_MS = 6000;     // highlight window for new wall tiles

export function SlideshowClient({
  lang,
  eventSlug,
  coupleNames,
  initialSlides,
  mode = "slideshow",
}: Props) {
  const t = DICT[lang];
  const [slides, setSlides] = useState<Slide[]>(initialSlides);
  const [index, setIndex] = useState(0);
  const [newCount, setNewCount] = useState(0);
  // Wall mode: ids highlighted as "just arrived" for a few seconds.
  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(new Set());
  const [cursorVisible, setCursorVisible] = useState(true);
  const idleTimerRef = useRef<number | null>(null);
  const newCountClearRef = useRef<number | null>(null);
  const slidesRef = useRef(slides);
  slidesRef.current = slides;
  // Outgoing slide kept around so the incoming one can crossfade over it.
  const prevSlideRef = useRef<Slide | null>(null);

  // Poll for new slides — chronological since-cursor.
  useEffect(() => {
    let cancelled = false;
    async function pump() {
      const latest = slidesRef.current[slidesRef.current.length - 1];
      const since = latest?.createdAt;
      const params = new URLSearchParams({ limit: "120" });
      if (since) params.set("since", since);
      try {
        const res = await fetch(
          `/api/event/${eventSlug}/slideshow?${params.toString()}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as SlideResponse;
        if (cancelled || !data.slides || data.slides.length === 0) return;
        // Dedupe in case the poll window overlaps with the seed.
        const seen = new Set(slidesRef.current.map((s) => s.id));
        const fresh = data.slides.filter((s) => !seen.has(s.id));
        if (fresh.length === 0) return;
        setSlides((prev) => [...prev, ...fresh]);
        setNewCount((n) => n + fresh.length);
        // Highlight the new tiles on the wall, then let them settle.
        const freshSet = new Set(fresh.map((s) => s.id));
        setFreshIds((prev) => new Set([...prev, ...freshSet]));
        window.setTimeout(() => {
          setFreshIds((prev) => {
            const next = new Set(prev);
            freshSet.forEach((id) => next.delete(id));
            return next;
          });
        }, WALL_FRESH_MS);
        if (newCountClearRef.current) window.clearTimeout(newCountClearRef.current);
        newCountClearRef.current = window.setTimeout(
          () => setNewCount(0),
          NEW_TOAST_MS,
        );
      } catch {
        // network blip; next tick will retry
      }
    }
    const t = window.setInterval(pump, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [eventSlug]);

  // Advance the slide. For images, fixed interval; for videos, wait for
  // playback end (or a hard cap).
  const advance = useCallback(() => {
    setIndex((i) => {
      const len = slidesRef.current.length;
      if (len === 0) return i;
      prevSlideRef.current = slidesRef.current[i % len] ?? null;
      return (i + 1) % len;
    });
  }, []);

  useEffect(() => {
    if (mode === "wall") return; // the wall doesn't advance
    if (slides.length === 0) return;
    const current = slides[index % slides.length];
    if (!current) return;
    if (current.kind === "image") {
      const t = window.setTimeout(advance, SLIDE_MS);
      return () => window.clearTimeout(t);
    }
    // Video: hard cap so a broken stream can't stall the slideshow.
    const t = window.setTimeout(advance, VIDEO_MAX_MS);
    return () => window.clearTimeout(t);
  }, [index, slides, advance, mode]);

  // Hide cursor when idle (projector mode).
  useEffect(() => {
    function poke() {
      setCursorVisible(true);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(
        () => setCursorVisible(false),
        IDLE_CURSOR_MS,
      );
    }
    poke();
    window.addEventListener("mousemove", poke);
    window.addEventListener("keydown", poke);
    return () => {
      window.removeEventListener("mousemove", poke);
      window.removeEventListener("keydown", poke);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, []);

  // Empty state — projector turned on before any guest uploaded.
  if (slides.length === 0) {
    return (
      <div className="fixed inset-0 bg-ink-900 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="uppercase tracking-[0.4em] text-xs text-blush-400 mb-4">
            {t.slideshowEyebrow}
          </p>
          <h1 className="font-serif text-6xl mb-6 animate-[fadeup_600ms_ease-out]">
            {coupleNames}
          </h1>
          <p className="text-white/80 animate-[fadeup_800ms_ease-out]">
            {t.slideshowWaiting}
          </p>
        </div>
      </div>
    );
  }

  if (mode === "wall") {
    // Newest first; cap the DOM so an all-night reception stays smooth.
    const tiles = slides.slice(-WALL_MAX_TILES).reverse();
    return (
      <div
        className={`fixed inset-0 bg-ink-900 overflow-hidden ${
          cursorVisible ? "" : "cursor-none"
        }`}
      >
        <div className="absolute inset-0 overflow-hidden px-4 pt-20 pb-4">
          <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-3">
            {tiles.map((s) => (
              <div
                key={s.id}
                className={`mb-3 break-inside-avoid overflow-hidden rounded-2xl ${
                  freshIds.has(s.id)
                    ? "ring-4 ring-blush-500 animate-[pop_500ms_cubic-bezier(0.2,0.8,0.4,1)_both]"
                    : "animate-[fadein_600ms_ease-out_both]"
                }`}
              >
                {s.kind === "video" ? (
                  <video
                    src={s.url}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="w-full"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.url} alt="" className="w-full" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Header overlay — same identity block as the slideshow. */}
        <div className="absolute top-0 left-0 right-0 px-8 py-4 flex items-center justify-between text-white/90 z-10 pointer-events-none bg-gradient-to-b from-ink-900/90 to-transparent">
          <div>
            <p className="uppercase tracking-[0.3em] text-[10px] text-blush-400 mb-0.5">
              {t.slideshowEyebrow}
            </p>
            <h1 className="font-serif text-2xl drop-shadow-lg">{coupleNames}</h1>
          </div>
          <div className="text-right text-xs text-white/60">
            <span>{t.wallPhotoCount(slides.length)}</span>
          </div>
        </div>

        {newCount > 0 ? (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 animate-[slidedown_500ms_ease-out]">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blush-500/90 text-white px-5 py-2 text-sm font-medium shadow-soft backdrop-blur">
              <SparkleIcon className="h-4 w-4" />
              {t.slideshowNewToast(newCount)}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  const current = slides[index % slides.length];
  const next = slides[(index + 1) % slides.length];
  const previous = prevSlideRef.current;

  return (
    <div
      className={`fixed inset-0 bg-ink-900 overflow-hidden ${
        cursorVisible ? "" : "cursor-none"
      }`}
    >
      {/* Crossfade: the outgoing slide stays mounted underneath while
          the incoming one fades in over it. key forces a fresh mount per
          slide so the Ken Burns animation restarts from zero. */}
      {previous && previous.id !== current.id ? (
        <SlideLayer key={`prev-${previous.id}`} slide={previous} entering={false} />
      ) : null}
      <SlideLayer key={current.id} slide={current} entering />

      {/* Preload next image to avoid any blink on transition. */}
      {next ? <link rel="preload" as="image" href={next.url} /> : null}

      {/* Corner overlays */}
      <div className="absolute top-0 left-0 right-0 p-8 flex items-center justify-between text-white/90 z-10 pointer-events-none">
        <div>
          <p className="uppercase tracking-[0.3em] text-[10px] text-blush-400 mb-1">
            {t.slideshowEyebrow}
          </p>
          <h1 className="font-serif text-3xl drop-shadow-lg">{coupleNames}</h1>
        </div>
        <div className="text-right text-xs text-white/60">
          <span>
            {t.slideshowCounter((index % slides.length) + 1, slides.length)}
          </span>
        </div>
      </div>

      {/* Toast for new uploads */}
      {newCount > 0 ? (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20 animate-[slidedown_500ms_ease-out]">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blush-500/90 text-white px-5 py-2 text-sm font-medium shadow-soft backdrop-blur">
            <SparkleIcon className="h-4 w-4" />
            {t.slideshowNewToast(newCount)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SlideLayer({ slide, entering }: { slide: Slide; entering: boolean }) {
  const fade = entering ? "animate-[fadein_800ms_ease-out_both]" : "";
  if (slide.kind === "video") {
    return (
      <video
        key={slide.id}
        src={slide.url}
        autoPlay
        muted
        playsInline
        className={`absolute inset-0 w-full h-full object-contain bg-black ${fade}`}
      />
    );
  }
  return (
    <div className={`absolute inset-0 ${fade}`}>
      {/* Background blurred copy fills the frame for portrait/landscape mix */}
      <div
        className="absolute inset-0 bg-cover bg-center scale-110 blur-2xl opacity-50"
        style={{ backgroundImage: `url(${slide.url})` }}
      />
      {/* Foreground photo with Ken Burns slow zoom */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={slide.url}
        alt=""
        className="relative w-full h-full object-contain animate-[kenburns_7s_ease-in-out_both]"
      />
    </div>
  );
}
