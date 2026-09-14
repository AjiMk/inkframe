import { useRef } from "react";
import { cn } from "@/lib/utils";
import type { SpeechBubble as SpeechBubbleData, TailDir } from "@/lib/comics/types";

interface Props {
  bubble: SpeechBubbleData;
  editable?: boolean;
  selected?: boolean;
  entering?: boolean;
  onSelect?: () => void;
  onDoubleClick?: () => void;
  onMove?: (x: number, y: number) => void;
  onResize?: (w: number) => void;
}

export function SpeechBubble({
  bubble,
  editable,
  selected,
  entering,
  onSelect,
  onDoubleClick,
  onMove,
  onResize,
}: Props) {
  const drag = useRef<{
    x: number;
    y: number;
    px: number;
    py: number;
    parent: DOMRect;
  } | null>(null);

  const hasMoved = useRef(false);

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!editable) return;
    event.stopPropagation();
    hasMoved.current = false;
    const parent = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!parent) return;
    try {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    } catch {
      // ignore pointer capture support issues
    }
    drag.current = {
      x: bubble.x,
      y: bubble.y,
      px: event.clientX,
      py: event.clientY,
      parent,
    };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current || !onMove) return;
    const dxPx = event.clientX - drag.current.px;
    const dyPx = event.clientY - drag.current.py;
    if (Math.hypot(dxPx, dyPx) > 4) {
      hasMoved.current = true;
    }
    if (!hasMoved.current) return;

    const dx = (dxPx / drag.current.parent.width) * 100;
    const dy = (dyPx / drag.current.parent.height) * 100;
    onMove(
      clamp(drag.current.x + dx, 0, 100 - bubble.w),
      clamp(drag.current.y + dy, 0, 95),
    );
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (drag.current) {
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // ignore
      }
      drag.current = null;
    }
  }

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!editable) return;
    event.stopPropagation();
    if (hasMoved.current) {
      event.preventDefault();
      return;
    }
    onSelect?.();
    onDoubleClick?.();
  }

  function startResize(event: React.PointerEvent<HTMLButtonElement>) {
    if (!editable || !onResize) return;
    event.stopPropagation();
    const parent = event.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
    if (!parent) return;
    const parentWidth = parent.width;
    const startW = bubble.w;
    const startX = event.clientX;
    const target = event.currentTarget;
    const resize = onResize;
    target.setPointerCapture(event.pointerId);
    function move(ev: PointerEvent) {
      const dw = ((ev.clientX - startX) / parentWidth) * 100;
      resize(clamp(startW + dw, 22, 96));
    }
    function up(ev: PointerEvent) {
      target.releasePointerCapture(ev.pointerId);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div
      className={cn(
        "absolute z-10 touch-none",
        entering && "anim-bubble",
        editable && "cursor-grab active:cursor-grabbing",
      )}
      style={{
        left: `${bubble.x}%`,
        top: `${bubble.y}%`,
        width: `${bubble.w}%`,
      }}
      onPointerDown={startDrag}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onClick={handleClick}
    >
      <div
        className={cn(
          "relative select-none px-2.5 py-1.5 text-center text-[0.78rem] leading-snug text-ink sm:text-sm",
          kindClass(bubble.kind),
          selected && "ring-2 ring-primary ring-offset-2 ring-offset-transparent",
        )}
      >
        {bubble.kind === "shout" ? (
          <span className="font-display text-base leading-snug sm:text-lg normal-case">
            {bubble.text}
          </span>
        ) : bubble.kind === "sfx" ? (
          <span className="comic-sfx-text block uppercase">
            {bubble.text}
          </span>
        ) : bubble.kind === "title-banner" ? (
          <span className="font-display text-sm sm:text-base tracking-widest uppercase">
            {bubble.text}
          </span>
        ) : bubble.kind === "burst-label" ? (
          <span className="font-display text-sm sm:text-base tracking-wider uppercase block">
            {bubble.text}
          </span>
        ) : (
          bubble.text
        )}
        {bubble.kind !== "caption" &&
        bubble.kind !== "shout" &&
        bubble.kind !== "sfx" &&
        bubble.kind !== "title-banner" &&
        bubble.kind !== "burst-label" ? (
          <BubbleTail kind={bubble.kind} dir={bubble.tail} />
        ) : null}
        {editable && selected ? (
          <button
            type="button"
            aria-label="Resize dialogue"
            className="absolute -right-1.5 top-1/2 size-4 -translate-y-1/2 rounded-full border border-ink bg-paper"
            onPointerDown={startResize}
          />
        ) : null}
      </div>
    </div>
  );
}

function kindClass(kind: SpeechBubbleData["kind"]) {
  switch (kind) {
    case "thought":
      return "rounded-[2.2rem] border-[3px] border-ink bg-paper";
    case "shout":
      return "border-[3px] border-ink bg-paper [clip-path:polygon(6%_10%,18%_0,34%_8%,50%_0,66%_9%,82%_0,96%_14%,88%_32%,100%_50%,87%_66%,97%_86%,74%_90%,60%_100%,46%_91%,28%_100%,12%_88%,0_74%,10%_56%,0_40%,12%_24%)] px-4 py-3";
    case "caption":
      return "rounded-sm border-2 border-ink bg-secondary text-left font-medium";
    case "sfx":
      return "bg-transparent p-0 border-none shadow-none";
    case "title-banner":
      return "comic-banner-box px-3 py-1 text-center";
    case "burst-label":
      return "comic-starburst-label";
    default:
      return "rounded-[1.4rem] border-[3px] border-ink bg-paper";
  }
}

function BubbleTail({
  kind,
  dir,
}: {
  kind: SpeechBubbleData["kind"];
  dir: TailDir;
}) {
  if (dir === "none") return null;
  const place: Record<Exclude<TailDir, "none">, string> = {
    bl: "left-[18%] top-full",
    br: "right-[18%] top-full",
    tl: "left-[18%] bottom-full rotate-180",
    tr: "right-[18%] bottom-full rotate-180",
  };

  if (kind === "thought") {
    const cluster: Record<Exclude<TailDir, "none">, string> = {
      bl: "left-4 top-full mt-1",
      br: "right-4 top-full mt-1",
      tl: "left-4 bottom-full mb-1 flex-col-reverse",
      tr: "right-4 bottom-full mb-1 flex-col-reverse",
    };
    return (
      <span className={cn("absolute flex items-center gap-1", cluster[dir])}>
        <span className="size-2.5 rounded-full border-[2.5px] border-ink bg-paper" />
        <span className="mt-1 size-1.5 rounded-full border-2 border-ink bg-paper" />
      </span>
    );
  }

  return (
    <svg
      viewBox="0 0 20 16"
      className={cn("absolute h-3.5 w-4 text-ink", place[dir])}
      aria-hidden
    >
      <polygon points="0,0 20,0 8,16" fill="currentColor" />
      <polygon points="3,0 17,0 8,12" className="fill-paper" />
    </svg>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
