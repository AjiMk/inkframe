import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Pause, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { coverRef } from "@/lib/comics/factory";
import { useMediaUrl } from "@/lib/comics/media";
import { useComicStore } from "@/lib/comics/store";
import type { Comic } from "@/lib/comics/types";
import { PageCanvas, type RevealState } from "./page-canvas";
import { CoverCanvas } from "./cover-canvas";

type Beat =
  | { type: "title" }
  | { type: "panel"; pageIndex: number; panelId: string; bubbleIds: string[]; activeBubbleId?: string }
  | { type: "page"; pageIndex: number }
  | { type: "end" };

export function ComicReader({ comicId }: { comicId: string }) {
  const navigate = useNavigate();
  const comic = useComicStore((s) => s.comics.find((c) => c.id === comicId));
  const hydrated = useComicStore((s) => s.hydrated);
  const [mode, setMode] = useState<"guided" | "flip">("guided");
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [dir, setDir] = useState<"next" | "prev">("next");
  const touch = useRef<{ x: number; y: number } | null>(null);

  const beats = useMemo(
    () => (comic ? buildBeats(comic, mode) : []),
    [comic, mode],
  );
  const beat = beats[index] ?? beats[0];

  useEffect(() => {
    setIndex(0);
    setPlaying(false);
  }, [mode, comicId]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setDir("next");
      setIndex((i) => Math.min(i + 1, Math.max(beats.length - 1, 0)));
    }, 2400);
    return () => window.clearInterval(id);
  }, [playing, beats.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Escape") {
        void navigate({ to: "/studio/$comicId", params: { comicId } });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function go(step: -1 | 1) {
    setPlaying(false);
    setDir(step > 0 ? "next" : "prev");
    setIndex((i) => Math.min(Math.max(i + step, 0), beats.length - 1));
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink text-sm text-paper/70">
        Loading book…
      </div>
    );
  }

  if (!comic || !beat) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-ink px-6 text-center text-paper">
        <p className="text-lg font-semibold">This comic is gone.</p>
        <Button asChild variant="secondary">
          <Link to="/">Back to the shelf</Link>
        </Button>
      </div>
    );
  }

  const pageIndex =
    beat.type === "panel" || beat.type === "page" ? beat.pageIndex : 0;
  const page = comic.pages[pageIndex];
  const reveal: RevealState | undefined =
    beat.type === "panel"
      ? {
          panelId: beat.panelId,
          visibleBubbleIds: beat.bubbleIds,
          activeBubbleId: beat.activeBubbleId,
          dimOthers: true,
        }
      : undefined;

  return (
    <div
      className="relative flex min-h-dvh flex-col bg-ink text-paper"
      onTouchStart={(e) => {
        const t = e.changedTouches[0];
        if (t) touch.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        const t = e.changedTouches[0];
        if (!t || !touch.current) return;
        const dx = t.clientX - touch.current.x;
        if (Math.abs(dx) > 56) go(dx < 0 ? 1 : -1);
        touch.current = null;
      }}
    >
      <header className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 bg-gradient-to-b from-ink/80 to-transparent px-2 py-2 sm:px-4">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="text-paper hover:bg-paper/10 hover:text-paper"
          aria-label="Close reader"
        >
          <Link to="/studio/$comicId" params={{ comicId }}>
            <X />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg leading-none tracking-wide">
            {comic.title}
          </p>
          <p className="truncate text-xs text-paper/60">
            {comic.author}
            {beat.type === "page" || beat.type === "panel"
              ? ` · Page ${pageIndex + 1} of ${comic.pages.length}`
              : null}
          </p>
        </div>
        <div className="flex rounded-full bg-paper/10 p-0.5 text-xs">
          <button
            type="button"
            className={`rounded-full px-3 py-1.5 ${mode === "guided" ? "bg-paper text-ink" : "text-paper/80"}`}
            onClick={() => setMode("guided")}
          >
            Guided
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1.5 ${mode === "flip" ? "bg-paper text-ink" : "text-paper/80"}`}
            onClick={() => setMode("flip")}
          >
            Flip
          </button>
        </div>
      </header>

      <div
        className="relative flex min-h-dvh flex-1 items-center justify-center px-3 pb-20 pt-16 sm:px-8"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          go(x < rect.width * 0.28 ? -1 : 1);
        }}
      >
        {beat.type === "title" ? (
          <TitleCard comic={comic} />
        ) : beat.type === "end" ? (
          <EndCard comicId={comicId} onReplay={() => setIndex(0)} />
        ) : page ? (
          <div className="flex h-full max-h-[calc(100dvh-130px)] w-full max-w-[580px] items-center justify-center transition-all duration-300 ease-out sm:max-w-[700px] md:max-w-[800px] lg:max-w-[920px] xl:max-w-[1060px] 2xl:max-w-[1200px]">
            <PageCanvas
              key={`${beat.type}-${index}`}
              page={page}
              mode="read"
              reveal={reveal}
              anim={dir}
              className="max-h-[calc(100dvh-130px)]"
            />
          </div>
        ) : null}
      </div>

      <footer className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-2 bg-gradient-to-t from-ink/85 to-transparent px-3 py-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-paper hover:bg-paper/10 hover:text-paper"
          onClick={() => go(-1)}
          aria-label="Previous"
        >
          <ChevronLeft />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-paper hover:bg-paper/10 hover:text-paper"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause /> : <Play className="ml-0.5" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-paper hover:bg-paper/10 hover:text-paper"
          onClick={() => go(1)}
          aria-label="Next"
        >
          <ChevronRight />
        </Button>
        <div className="ml-2 hidden h-1 w-40 overflow-hidden rounded-full bg-paper/20 sm:block">
          <div
            className="h-full bg-primary transition-[width] duration-300 ease-out"
            style={{
              width: `${beats.length <= 1 ? 100 : (index / (beats.length - 1)) * 100}%`,
            }}
          />
        </div>
      </footer>
    </div>
  );
}

function TitleCard({ comic }: { comic: Comic }) {
  return (
    <div className="anim-rise flex w-full max-w-2xl flex-col items-center justify-center text-center">
      <div className="flex max-h-[calc(100dvh-140px)] w-full max-w-[420px] items-center justify-center transition-all duration-300 ease-out sm:max-w-[520px] md:max-w-[620px] lg:max-w-[720px] xl:max-w-[820px]">
        <CoverCanvas comic={comic} mode="read" />
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-paper/60">
        Tap anywhere to begin
      </p>
    </div>
  );
}

function EndCard({ comicId, onReplay }: { comicId: string; onReplay: () => void }) {
  return (
    <div
      className="anim-rise flex flex-col items-center gap-5 px-6 text-center"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="font-display text-5xl text-paper">The End</p>
      <p className="max-w-sm text-sm text-paper/70">
        Flip it again, or jump back into the studio to rewrite the next panel.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" variant="secondary" onClick={onReplay}>
          Read again
        </Button>
        <Button asChild>
          <Link to="/studio/$comicId" params={{ comicId }}>
            Edit comic
          </Link>
        </Button>
      </div>
    </div>
  );
}

function buildBeats(comic: Comic, mode: "guided" | "flip"): Beat[] {
  const beats: Beat[] = [{ type: "title" }];
  comic.pages.forEach((page, pageIndex) => {
    if (mode === "guided") {
      page.panels.forEach((panel) => {
        if (panel.bubbles.length === 0) {
          beats.push({ type: "panel", pageIndex, panelId: panel.id, bubbleIds: [] });
          return;
        }
        const ids: string[] = [];
        for (const bubble of panel.bubbles) {
          ids.push(bubble.id);
          beats.push({
            type: "panel",
            pageIndex,
            panelId: panel.id,
            bubbleIds: [...ids],
            activeBubbleId: bubble.id,
          });
        }
      });
    } else {
      beats.push({ type: "page", pageIndex });
    }
  });
  beats.push({ type: "end" });
  return beats;
}
