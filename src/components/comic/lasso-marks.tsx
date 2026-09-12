import { useEffect, useRef, useState } from "react";
import {
  distPoint,
  movePath,
  pointInPolygon,
  polygonArea,
  simplifyPath,
} from "@/lib/comics/faces";
import type { NormPoint } from "@/lib/comics/types";
import { cn } from "@/lib/utils";

export interface LassoPath {
  id: string;
  points: NormPoint[];
  label?: string;
}

function clientToNorm(el: HTMLElement, clientX: number, clientY: number): NormPoint {
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return { x: 0, y: 0 };
  return {
    x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
  };
}

function toSvgPoints(points: NormPoint[]) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function pathD(points: NormPoint[]) {
  if (points.length === 0) return "";
  return `M ${points.map((point) => `${point.x} ${point.y}`).join(" L ")} Z`;
}

const SAMPLE_DIST = 0.007;
const CLOSE_DIST = 0.03;
const MIN_AREA = 0.004;

export function LassoMarks({
  paths,
  selectedId,
  onSelect,
  onChange,
  onCreate,
  className,
}: {
  paths: LassoPath[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, points: NormPoint[]) => void;
  onCreate: (points: NormPoint[]) => string;
  className?: string;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const draftRef = useRef<NormPoint[]>([]);
  const dragRef = useRef<{
    pointerId: number;
    kind: "lasso" | "move" | "vertex" | "polygon";
    originPoints: NormPoint[];
    start: NormPoint;
    id: string | null;
    vertexIndex?: number;
  } | null>(null);
  const [draft, setDraft] = useState<NormPoint[]>([]);
  const [cursor, setCursor] = useState<NormPoint | null>(null);
  const [polygonMode, setPolygonMode] = useState(false);

  function setDraftPoints(points: NormPoint[]) {
    draftRef.current = points;
    setDraft(points);
  }

  function closeDraft(raw: NormPoint[]) {
    const cleaned = simplifyPath(raw, 0.0035);
    if (cleaned.length < 3 || polygonArea(cleaned) < MIN_AREA) {
      setDraftPoints([]);
      setPolygonMode(false);
      setCursor(null);
      return;
    }
    onCreate(cleaned);
    setDraftPoints([]);
    setPolygonMode(false);
    setCursor(null);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "Escape") {
        setDraftPoints([]);
        setPolygonMode(false);
        setCursor(null);
        dragRef.current = null;
      }
      if ((e.key === "Enter" || e.key === " ") && draftRef.current.length >= 3) {
        e.preventDefault();
        closeDraft(draftRef.current);
      }
      if ((e.key === "Backspace" || e.key === "Delete") && polygonMode && draftRef.current.length > 1) {
        e.preventDefault();
        setDraftPoints(draftRef.current.slice(0, -1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [polygonMode, onCreate]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const point = clientToNorm(stage, e.clientX, e.clientY);
    const drag = dragRef.current;

    if (!drag) {
      if (polygonMode) setCursor(point);
      return;
    }

    if (drag.kind === "lasso") {
      setDraftPoints((() => {
        const prev = draftRef.current;
        const last = prev[prev.length - 1];
        if (last && distPoint(last, point) < SAMPLE_DIST) return prev;
        return [...prev, point];
      })());
      return;
    }

    if (drag.kind === "move" && drag.id) {
      onChange(
        drag.id,
        movePath(drag.originPoints, point.x - drag.start.x, point.y - drag.start.y),
      );
      return;
    }

    if (drag.kind === "vertex" && drag.id && drag.vertexIndex != null) {
      const next = drag.originPoints.map((item, index) =>
        index === drag.vertexIndex
          ? { x: Math.max(0, Math.min(1, point.x)), y: Math.max(0, Math.min(1, point.y)) }
          : item,
      );
      onChange(drag.id, next);
    }
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(drag.pointerId);
    } catch {
      /* already released */
    }
    if (drag.kind === "lasso") {
      const points = draftRef.current;
      if (points.length < 6 && polygonArea(points) < MIN_AREA) {
        setPolygonMode(true);
        setDraftPoints(points.length ? points : [drag.start]);
        setCursor(drag.start);
      } else {
        closeDraft(points);
      }
    }
    dragRef.current = null;
  };

  return (
    <div
      ref={stageRef}
      className={cn("absolute inset-0 touch-none cursor-crosshair", className)}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        if ((e.target as HTMLElement).closest("[data-lasso-vertex]")) return;
        const stage = stageRef.current;
        if (!stage) return;
        const point = clientToNorm(stage, e.clientX, e.clientY);

        if (polygonMode) {
          e.preventDefault();
          if (draft.length >= 3 && distPoint(draft[0], point) <= CLOSE_DIST) {
            closeDraft(draftRef.current);
            return;
          }
          setDraftPoints([...draftRef.current, point]);
          setCursor(point);
          return;
        }

        const hit = [...paths].reverse().find((path) => pointInPolygon(point, path.points));
        if (hit) {
          e.stopPropagation();
          e.preventDefault();
          onSelect(hit.id);
          e.currentTarget.setPointerCapture(e.pointerId);
          dragRef.current = {
            pointerId: e.pointerId,
            kind: "move",
            originPoints: hit.points,
            start: point,
            id: hit.id,
          };
          return;
        }

        e.preventDefault();
        onSelect(null);
        e.currentTarget.setPointerCapture(e.pointerId);
        setDraftPoints([point]);
        setPolygonMode(false);
        dragRef.current = {
          pointerId: e.pointerId,
          kind: "lasso",
          originPoints: [point],
          start: point,
          id: null,
        };
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={(e) => {
        if (polygonMode && draft.length >= 3) {
          e.preventDefault();
          closeDraft(draftRef.current);
        }
      }}
    >
      <svg
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        {paths.map((path) => {
          const selected = path.id === selectedId;
          return (
            <g key={path.id}>
              {selected ? (
                <path
                  d={`M 0 0 H 1 V 1 H 0 Z ${pathD(path.points)}`}
                  fill="var(--color-ink)"
                  fillOpacity="0.38"
                  fillRule="evenodd"
                  className="pointer-events-none"
                />
              ) : null}
              <polygon
                points={toSvgPoints(path.points)}
                fill={selected ? "color-mix(in oklab, var(--color-primary) 28%, transparent)" : "color-mix(in oklab, var(--color-primary) 12%, transparent)"}
                stroke="var(--color-primary)"
                strokeWidth={selected ? 2 : 1.5}
                vectorEffect="non-scaling-stroke"
                className={selected ? "selection-ants" : undefined}
              />
            </g>
          );
        })}
        {draft.length > 0 ? (
          <polyline
            points={toSvgPoints(cursor && polygonMode ? [...draft, cursor] : draft)}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            className="selection-ants"
          />
        ) : null}
      </svg>

      {paths.map((path) => {
        if (!path.label || !path.points[0]) return null;
        const labelPoint = path.points[0];
        return (
          <span
            key={`${path.id}-label`}
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground shadow-sm"
            style={{ left: `${labelPoint.x * 100}%`, top: `${labelPoint.y * 100}%` }}
          >
            {path.label}
          </span>
        );
      })}

      {paths
        .filter((path) => path.id === selectedId)
        .flatMap((path) =>
          path.points.map((point, index) => (
            <button
              key={`${path.id}-${index}`}
              type="button"
              data-lasso-vertex
              aria-label={`Move point ${index + 1}`}
              className="absolute z-20 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-card shadow-sm"
              style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                const stage = stageRef.current;
                if (!stage) return;
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                onSelect(path.id);
                dragRef.current = {
                  pointerId: e.pointerId,
                  kind: "vertex",
                  originPoints: path.points,
                  start: point,
                  id: path.id,
                  vertexIndex: index,
                };
              }}
            />
          )),
        )}

      {polygonMode && draft[0] ? (
        <span
          className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-primary-foreground"
          style={{ left: `${draft[0].x * 100}%`, top: `${draft[0].y * 100}%` }}
        />
      ) : null}
    </div>
  );
}

export { MIN_AREA };
