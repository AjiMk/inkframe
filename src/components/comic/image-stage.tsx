import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
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

