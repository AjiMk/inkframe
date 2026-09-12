import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { boxFromPoints, clampNormBox } from "@/lib/comics/faces";
import type { NormBox } from "@/lib/comics/types";
import { cn } from "@/lib/utils";

interface FitRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function useContainRect(imgW: number, imgH: number): {
  ref: React.RefObject<HTMLDivElement | null>;
  fit: FitRect;
} {
  const ref = useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = useState<FitRect>({ left: 0, top: 0, width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !imgW || !imgH) return;

    const measure = () => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (!cw || !ch) return;
      const imgAspect = imgW / imgH;
      const cAspect = cw / ch;
      let width = cw;
      let height = ch;
      let left = 0;
      let top = 0;
      if (imgAspect > cAspect) {
        height = cw / imgAspect;
        top = (ch - height) / 2;
      } else {
        width = ch * imgAspect;
        left = (cw - width) / 2;
      }
      setFit({ left, top, width, height });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [imgW, imgH]);

  return { ref, fit };
}

export function ImageStage({
  imgW,
  imgH,
  className,
  children,
}: {
  imgW: number;
  imgH: number;
  className?: string;
  children: ReactNode;
}) {
  const { ref, fit } = useContainRect(imgW, imgH);
  return (
    <div ref={ref} className={cn("relative overflow-hidden ink-stage select-none", className)}>
      <div
        className="absolute overflow-visible"
        style={{ left: fit.left, top: fit.top, width: fit.width, height: fit.height }}
      >
        {children}
      </div>
    </div>
  );
}

export interface MarkedBox extends NormBox {
  id: string;
  label?: string;
}

type Handle = "move" | "nw" | "ne" | "sw" | "se";

function clientToNorm(el: HTMLElement, clientX: number, clientY: number) {
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return { x: 0, y: 0 };
  return {
    x: (clientX - rect.left) / rect.width,
    y: (clientY - rect.top) / rect.height,
  };
}

function applyHandle(box: NormBox, handle: Handle, nx: number, ny: number, origin: NormBox): NormBox {
  if (handle === "move") {
    return clampNormBox({
      x: origin.x + nx,
      y: origin.y + ny,
      width: origin.width,
      height: origin.height,
    });
  }
  const end = {
    x: origin.x + origin.width,
    y: origin.y + origin.height,
  };
  const start = { x: origin.x, y: origin.y };
  if (handle.includes("w")) start.x = origin.x + nx;
  if (handle.includes("e")) end.x = origin.x + origin.width + nx;
  if (handle.includes("n")) start.y = origin.y + ny;
  if (handle.includes("s")) end.y = origin.y + origin.height + ny;
  return boxFromPoints(start, end, 0.04);
}

export function OvalMarks({
  boxes,
  selectedId,
  allowCreate = false,
  onSelect,
  onChange,
  onCreate,
  onRemove,
  className,
}: {
  boxes: MarkedBox[];
  selectedId: string | null;
  allowCreate?: boolean;
  onSelect: (id: string) => void;
  onChange: (id: string, next: NormBox) => void;
  onCreate?: (box: NormBox) => string;
  onRemove?: (id: string) => void;
  className?: string;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    handle: Handle | "create";
    origin: NormBox;
    start: { x: number; y: number };
    id: string | null;
  } | null>(null);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || !stage) return;
    const point = clientToNorm(stage, e.clientX, e.clientY);
    if (drag.handle === "create") {
      const next = boxFromPoints(drag.start, point, 0.02);
      if (drag.id) onChange(drag.id, next);
      return;
    }
    const dx = point.x - drag.start.x;
    const dy = point.y - drag.start.y;
    if (drag.id) onChange(drag.id, applyHandle(drag.origin, drag.handle, dx, dy, drag.origin));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(drag.pointerId);
    } catch {
      /* already released */
    }
    if (drag.handle === "create" && drag.id) {
      const box = boxes.find((item) => item.id === drag.id);
      if (box && (box.width < 0.04 || box.height < 0.04)) {
        onRemove?.(drag.id);
      }
    }
    dragRef.current = null;
  };

  const startCreate = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!allowCreate || !onCreate || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-oval-box]")) return;
    const stage = stageRef.current;
    if (!stage) return;
    const point = clientToNorm(stage, e.clientX, e.clientY);
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const createdId = onCreate({ x: point.x, y: point.y, width: 0.02, height: 0.02 });
    dragRef.current = {
      pointerId: e.pointerId,
      handle: "create",
      origin: { x: point.x, y: point.y, width: 0.02, height: 0.02 },
      start: point,
      id: createdId,
    };
  };

  return (
    <div
      ref={stageRef}
      className={cn("absolute inset-0 touch-none", allowCreate ? "cursor-crosshair" : "", className)}
      onPointerDown={startCreate}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {boxes
        .filter((box) => box.width > 0 && box.height > 0)
        .map((box) => {
          const selected = box.id === selectedId;
          return (
            <div
              key={box.id}
              data-oval-box
              style={{
                left: `${box.x * 100}%`,
                top: `${box.y * 100}%`,
                width: `${box.width * 100}%`,
                height: `${box.height * 100}%`,
              }}
              className={cn(
                "absolute rounded-full border-2",
                selected
                  ? "z-10 border-primary bg-primary/15 shadow-[0_0_0_1px_var(--color-card)]"
                  : "border-paper/80 bg-foreground/10 hover:border-primary",
              )}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                e.preventDefault();
                onSelect(box.id);
                const stage = stageRef.current;
                if (!stage) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                dragRef.current = {
                  pointerId: e.pointerId,
                  handle: "move",
                  origin: { x: box.x, y: box.y, width: box.width, height: box.height },
                  start: clientToNorm(stage, e.clientX, e.clientY),
                  id: box.id,
                };
              }}
            >
              {box.label ? (
                <span className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground shadow-sm">
                  {box.label}
                </span>
              ) : null}
              {selected
                ? (["nw", "ne", "sw", "se"] as Handle[]).map((handle) => (
                    <button
                      key={handle}
                      type="button"
                      aria-label={`Resize ${handle}`}
                      className={cn(
                        "absolute size-3.5 rounded-full border-2 border-primary bg-card shadow-sm",
                        handle === "nw" && "-left-1.5 -top-1.5 cursor-nwse-resize",
                        handle === "ne" && "-right-1.5 -top-1.5 cursor-nesw-resize",
                        handle === "sw" && "-bottom-1.5 -left-1.5 cursor-nesw-resize",
                        handle === "se" && "-bottom-1.5 -right-1.5 cursor-nwse-resize",
                      )}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const stage = stageRef.current;
                        if (!stage) return;
                        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                        onSelect(box.id);
                        dragRef.current = {
                          pointerId: e.pointerId,
                          handle,
                          origin: { x: box.x, y: box.y, width: box.width, height: box.height },
                          start: clientToNorm(stage, e.clientX, e.clientY),
                          id: box.id,
                        };
                      }}
                    />
                  ))
                : null}
            </div>
          );
        })}
    </div>
  );
}
