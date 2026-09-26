import { useRef } from "react";
import { cn } from "@/lib/utils";
import { useMediaUrl } from "@/lib/comics/media";
import type { Comic } from "@/lib/comics/types";
import { defaultCoverConfig } from "@/lib/comics/factory";
import { useComicStore } from "@/lib/comics/store";

interface CoverCanvasProps {
  comic: Comic;
  mode?: "edit" | "read" | "thumb";
  className?: string;
  onClick?: () => void;
}

export function CoverCanvas({
  comic,
  mode = "edit",
  className,
  onClick,
}: CoverCanvasProps) {
  const store = useComicStore();
  const defaultConfig = defaultCoverConfig();
  const config = comic.coverConfig ?? defaultConfig;
  const coverImgSrc = useMediaUrl(comic.cover || comic.pages[0]?.panels[0]?.image || null);

  const title = comic.title || "UNTITLED COMIC";
  const author = comic.author || "BY ANONYMOUS";

  const pos = config.positions ?? defaultConfig.positions!;

  function handleElementMove(key: string, newPos: { x: number; y: number }) {
    if (mode !== "edit") return;
    const currentPositions = config.positions ?? defaultConfig.positions!;
    store.setCoverConfig(comic.id, {
      positions: {
        ...currentPositions,
        [key]: newPos,
      },
    });
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-ink p-2 select-none shadow-xl border-4 border-ink",
        mode === "thumb" && "p-1 border-2 pointer-events-none",
        className,
      )}
    >
      {/* Outer Cover Paper Frame */}
      <div className={cn(
        "relative flex h-full w-full flex-col justify-between overflow-hidden rounded-[2px] bg-[#f8f1e1] p-3 text-ink",
        config.template === "vintage" && "bg-[#f4e6cd]",
        config.template === "pulp" && "bg-[#e5d5b7]",
        config.template === "graphic-novel" && "bg-[#18181b] text-paper",
        mode === "thumb" && "p-1.5",
      )}>
        {/* Cover Art / Background Image */}
        <div className="absolute inset-0 z-0">
          {coverImgSrc ? (
            <img
              src={coverImgSrc}
              alt={title}
              className={cn(
                "h-full w-full object-cover",
                config.template === "vintage" && "filter contrast-125 sepia-25",
                config.template === "graphic-novel" && "filter grayscale contrast-150 brightness-90",
              )}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-secondary/80 p-6 text-center">
              <div className="rounded-lg border-2 border-dashed border-muted-foreground/40 p-4">
                <p className="font-display text-lg text-muted-foreground">Add Cover Artwork</p>
                <p className="text-xs text-muted-foreground/70">Drop a photo or assign from Studio Editor</p>
              </div>
            </div>
          )}
          {/* Halftone texture overlay */}
          <div className="halftone-dot absolute inset-0 pointer-events-none opacity-40 mix-blend-multiply" />
        </div>

        {/* DRAGGABLE COVER BANNER ELEMENTS */}

        {/* 1. Corner Issue Box */}
        <DraggableElement
          elementKey="issueBox"
          pos={pos.issueBox ?? { x: 3, y: 3 }}
          mode={mode}
          onMove={handleElementMove}
        >
          <div className={cn(
            "flex flex-col items-center justify-center border-2 border-ink bg-paper p-1 shadow-[2px_2px_0px_#161310] text-center min-w-12",
            config.template === "action" && "bg-[#dc2626] text-white border-white shadow-[2px_2px_0px_#000]",
            mode === "thumb" && "min-w-8 p-0.5 border shadow-none text-[8px]",
          )}>
            <span className="font-display text-[9px] sm:text-[11px] leading-none uppercase text-muted-foreground">
              {config.issueDate || "VOL. 1"}
            </span>
            <span className="font-display text-sm sm:text-lg leading-none font-bold text-primary">
              {config.issueNumber || "#1"}
            </span>
            <span className="font-semibold text-[8px] sm:text-[10px] leading-none">
              {config.issuePrice || "25¢"}
            </span>
          </div>
        </DraggableElement>

        {/* 2. Tagline Ribbon Banner */}
        {config.tagline && (
          <DraggableElement
            elementKey="tagline"
            pos={pos.tagline ?? { x: 22, y: 3 }}
            mode={mode}
            onMove={handleElementMove}
          >
            <div className={cn(
              "border-2 border-ink bg-[#fef08a] px-3 py-0.5 text-center shadow-[2px_2px_0px_#161310]",
              config.template === "pulp" && "bg-[#ea580c] text-white",
              mode === "thumb" && "border px-1 py-0 text-[7px] shadow-none",
            )}>
              <p className="font-display text-[10px] sm:text-xs tracking-wider uppercase truncate">
                {config.tagline}
              </p>
            </div>
          </DraggableElement>
        )}

        {/* 3. Comics Code Authority Seal */}
        {config.showComicsCode && (
          <DraggableElement
            elementKey="comicsCode"
            pos={pos.comicsCode ?? { x: 82, y: 3 }}
            mode={mode}
            onMove={handleElementMove}
          >
            <div className={cn(
              "flex flex-col items-center justify-center border-2 border-ink bg-paper p-1 text-[7px] sm:text-[9px] font-bold leading-tight shadow-[2px_2px_0px_#161310] text-center uppercase min-w-10",
              mode === "thumb" && "hidden",
            )}>
              <span className="text-[6px] tracking-tighter">APPROVED BY THE</span>
              <span className="font-display text-[9px] text-primary">COMICS</span>
              <span className="text-[6px] tracking-tighter">CODE</span>
              <span className="text-[5px] border-t border-ink pt-0.5">AUTHORITY</span>
            </div>
          </DraggableElement>
        )}

        {/* 4. Main Title Masthead */}
        <DraggableElement
          elementKey="title"
          pos={pos.title ?? { x: 4, y: 15 }}
          mode={mode}
          onMove={handleElementMove}
        >
          <div className="text-center">
            <h1
              className={cn(
                "cover-title-3d text-3xl sm:text-5xl lg:text-6xl font-black uppercase tracking-wide drop-shadow-md",
                config.titleStyle === "retro-bold" && "font-display text-[#dc2626]",
                config.titleStyle === "neon-glitch" && "font-display text-[#06b6d4]",
                config.titleStyle === "distressed-pulp" && "font-display text-[#ea580c]",
                mode === "thumb" && "text-base sm:text-lg text-stroke-none shadow-none",
              )}
              style={{
                color: config.titleColor || "#facc15",
              }}
            >
              {title}
            </h1>
          </div>
        </DraggableElement>

        {/* 5. Subtitle Banner */}
        {config.subtitle && (
          <DraggableElement
            elementKey="subtitle"
            pos={pos.subtitle ?? { x: 12, y: 28 }}
            mode={mode}
            onMove={handleElementMove}
          >
            <div className="text-center">
              <p className={cn(
                "font-display text-xs sm:text-sm tracking-widest uppercase text-paper bg-ink/90 px-2.5 py-0.5 inline-block rounded-xs border border-paper/30 shadow-[2px_2px_0px_#161310]",
                mode === "thumb" && "text-[7px] py-0 px-1",
              )}>
                {config.subtitle}
              </p>
            </div>
          </DraggableElement>
        )}

        {/* 6. Author Byline Badge */}
        <DraggableElement
          elementKey="authorBadge"
          pos={pos.authorBadge ?? { x: 3, y: 86 }}
          mode={mode}
          onMove={handleElementMove}
        >
          <div className={cn(
            "rounded-sm border-2 border-ink bg-paper/95 px-2 py-1 shadow-[2px_2px_0px_#161310]",
            config.template === "graphic-novel" && "bg-ink/90 text-paper border-paper/40",
            mode === "thumb" && "border px-1 py-0.5 text-[8px] shadow-none",
          )}>
            <p className="text-[9px] sm:text-[11px] font-bold tracking-wide uppercase text-muted-foreground">
              CREATED BY
            </p>
            <p className="font-display text-xs sm:text-base text-foreground leading-none">
              {author}
            </p>
          </div>
        </DraggableElement>

        {/* 7. Barcode Stamp */}
        {config.showBarcode && (
          <DraggableElement
            elementKey="barcode"
            pos={pos.barcode ?? { x: 74, y: 84 }}
            mode={mode}
            onMove={handleElementMove}
          >
            <div className={cn(
              "flex flex-col items-center justify-center border-2 border-ink bg-paper p-1 shadow-[2px_2px_0px_#161310]",
              mode === "thumb" && "hidden",
            )}>
              <div className="flex h-5 items-center gap-0.5 px-1 bg-white">
                <div className="h-full w-0.5 bg-black" />
                <div className="h-full w-1 bg-black" />
                <div className="h-full w-0.5 bg-black" />
                <div className="h-full w-1.5 bg-black" />
                <div className="h-full w-0.5 bg-black" />
                <div className="h-full w-1 bg-black" />
                <div className="h-full w-0.5 bg-black" />
                <div className="h-full w-1 bg-black" />
              </div>
              <span className="text-[7px] font-mono font-bold leading-none mt-0.5">0 71486 01234 5</span>
            </div>
          </DraggableElement>
        )}
      </div>
    </div>
  );
}

interface DraggableElementProps {
  elementKey: string;
  pos: { x: number; y: number };
  mode: "edit" | "read" | "thumb";
  onMove: (key: string, pos: { x: number; y: number }) => void;
  children: React.ReactNode;
}

function DraggableElement({
  elementKey,
  pos,
  mode,
  onMove,
  children,
}: DraggableElementProps) {
  const drag = useRef<{
    x: number;
    y: number;
    px: number;
    py: number;
    parentRect: DOMRect;
  } | null>(null);
  const hasMoved = useRef(false);

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (mode !== "edit") return;
    event.stopPropagation();
    hasMoved.current = false;
    const parentRect = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!parentRect) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      x: pos.x,
      y: pos.y,
      px: event.clientX,
      py: event.clientY,
      parentRect,
    };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const dxPx = event.clientX - drag.current.px;
    const dyPx = event.clientY - drag.current.py;
    if (Math.hypot(dxPx, dyPx) > 4) {
      hasMoved.current = true;
    }
    if (!hasMoved.current) return;
    const dx = (dxPx / drag.current.parentRect.width) * 100;
    const dy = (dyPx / drag.current.parentRect.height) * 100;
    onMove(elementKey, {
      x: Math.min(88, Math.max(0, drag.current.x + dx)),
      y: Math.min(92, Math.max(0, drag.current.y + dy)),
    });
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (drag.current) {
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // ignore pointer capture release error
      }
      drag.current = null;
    }
  }

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (hasMoved.current) {
      event.preventDefault();
    }
  }

  return (
    <div
      className={cn(
        "absolute z-10 touch-none transition-[box-shadow,border] duration-150",
        mode === "edit" && "cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-primary/60 hover:ring-offset-1 rounded-xs",
      )}
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
      }}
      onPointerDown={startDrag}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onClick={handleClick}
    >
      {children}
    </div>
  );
}
