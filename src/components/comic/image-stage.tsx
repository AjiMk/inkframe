import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
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

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

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
  const fitRef = useRef(fit);
  fitRef.current = fit;
  const viewRef = useRef({ z: 1, x: 0, y: 0 });
  const panDragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);
  const spaceRef = useRef(false);
  const hoverRef = useRef(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);

  useLayoutEffect(() => {
    viewRef.current = { z: 1, x: 0, y: 0 };
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [imgW, imgH]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const applyView = (z: number, x: number, y: number) => {
      const nextZ = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
      const nextX = nextZ <= 1.001 ? 0 : x;
      const nextY = nextZ <= 1.001 ? 0 : y;
      const next = { z: nextZ <= 1.001 ? 1 : nextZ, x: nextX, y: nextY };
      viewRef.current = next;
      setZoom(next.z);
      setPan({ x: next.x, y: next.y });
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const current = viewRef.current;
      const nextZ = current.z * Math.exp(-e.deltaY * 0.0018);
      const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZ));
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const fitted = fitRef.current;
      const localX = (mx - fitted.left - current.x) / current.z;
      const localY = (my - fitted.top - current.y) / current.z;
      applyView(
        clamped,
        mx - fitted.left - localX * clamped,
        my - fitted.top - localY * clamped,
      );
    };

    const onPointerMove = (e: PointerEvent) => {
      const drag = panDragRef.current;
      if (!drag) return;
      applyView(
        viewRef.current.z,
        drag.panX + (e.clientX - drag.x),
        drag.panY + (e.clientY - drag.y),
      );
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!panDragRef.current || panDragRef.current.pointerId !== e.pointerId) return;
      panDragRef.current = null;
      setPanning(false);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [ref]);

  useEffect(() => {
    const isTyping = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return Boolean(
        el &&
          (el.tagName === "INPUT" ||
            el.tagName === "TEXTAREA" ||
            el.isContentEditable),
      );
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTyping(e.target) || !hoverRef.current) return;
      e.preventDefault();
      spaceRef.current = true;
      setSpaceHeld(true);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      spaceRef.current = false;
      setSpaceHeld(false);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    const onBlur = () => {
      spaceRef.current = false;
      setSpaceHeld(false);
    };
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "relative overflow-hidden ink-stage select-none touch-none",
        (spaceHeld || panning) && zoom > 1 ? (panning ? "cursor-grabbing" : "cursor-grab") : "",
        className,
      )}
      onPointerEnter={() => {
        hoverRef.current = true;
      }}
      onPointerLeave={() => {
        hoverRef.current = false;
      }}
      onPointerDownCapture={(e) => {
        const panWithSpace = spaceRef.current && e.button === 0;
        const panWithMiddle = e.button === 1;
        if (!panWithSpace && !panWithMiddle) return;
        if (zoom <= 1) return;
        e.preventDefault();
        e.stopPropagation();
        panDragRef.current = {
          pointerId: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          panX: viewRef.current.x,
          panY: viewRef.current.y,
        };
        setPanning(true);
      }}
    >
      <div
        className="absolute overflow-visible will-change-transform"
        style={{
          left: fit.left,
          top: fit.top,
          width: fit.width,
          height: fit.height,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {children}
      </div>
      {zoom > 1.02 ? (
        <div className="pointer-events-none absolute right-2 top-2 rounded-md border border-border bg-card/90 px-2 py-1 text-xs font-medium text-foreground">
          {Math.round(zoom * 100)}%
        </div>
      ) : null}
    </div>
  );
}

export interface MarkedBox extends NormBox {
  id: string;
  label?: string;
  rotation?: number;
}

type Handle = "move" | "nw" | "ne" | "sw" | "se" | "rotate";

function clientToNorm(el: HTMLElement, clientX: number, clientY: number) {
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return { x: 0, y: 0 };
  return {
    x: (clientX - rect.left) / rect.width,
    y: (clientY - rect.top) / rect.height,
  };
}

function angleFromCenter(origin: NormBox, point: { x: number; y: number }) {
  const cx = origin.x + origin.width / 2;
  const cy = origin.y + origin.height / 2;
  return (Math.atan2(point.x - cx, cy - point.y) * 180) / Math.PI;
}

function wrapDelta(deg: number) {
  const wrapped = ((((deg + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
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
  if (handle === "rotate") return box;
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
  onRotate,
  className,
}: {
  boxes: MarkedBox[];
  selectedId: string | null;
  allowCreate?: boolean;
  onSelect: (id: string) => void;
  onChange: (id: string, next: NormBox) => void;
  onCreate?: (box: NormBox) => string;
  onRemove?: (id: string) => void;
  onRotate?: (id: string, rotation: number) => void;
  className?: string;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    handle: Handle | "create";
    origin: NormBox;
    start: { x: number; y: number };
    id: string | null;
    startAngle?: number;
    originRotation?: number;
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
    if (drag.handle === "rotate") {
      if (!drag.id || !onRotate) return;
      const current = angleFromCenter(drag.origin, point);
      let next = (drag.originRotation ?? 0) + wrapDelta(current - (drag.startAngle ?? 0));
      if (e.shiftKey) next = Math.round(next / 15) * 15;
      onRotate(drag.id, wrapDelta(next));
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
                "absolute border-2",
                selected
                  ? "z-10 rounded-md border-primary bg-primary/15 shadow-[0_0_0_1px_var(--color-card)]"
                  : "rounded-md border-paper/80 bg-foreground/10 hover:border-primary",
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
                <span
                  className={cn(
                    "pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground shadow-sm",
                    selected && onRotate ? "bottom-0 translate-y-1/2" : "top-0 -translate-y-1/2",
                  )}
                >
                  {box.label}
                </span>
              ) : null}
              {selected && onRotate ? (
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{ transform: `rotate(${box.rotation ?? 0}deg)` }}
                >
                  <div className="absolute left-1/2 top-0 h-6 w-px -translate-x-1/2 -translate-y-full bg-primary" />
                  <button
                    type="button"
                    aria-label="Rotate face"
                    className="pointer-events-auto absolute left-1/2 top-0 size-4 -translate-x-1/2 -translate-y-6 cursor-grab rounded-full border-2 border-primary bg-card shadow-sm active:cursor-grabbing"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      const stage = stageRef.current;
                      if (!stage) return;
                      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                      onSelect(box.id);
                      const point = clientToNorm(stage, e.clientX, e.clientY);
                      const origin = { x: box.x, y: box.y, width: box.width, height: box.height };
                      dragRef.current = {
                        pointerId: e.pointerId,
                        handle: "rotate",
                        origin,
                        start: point,
                        id: box.id,
                        startAngle: angleFromCenter(origin, point),
                        originRotation: box.rotation ?? 0,
                      };
                    }}
                  />
                </div>
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
