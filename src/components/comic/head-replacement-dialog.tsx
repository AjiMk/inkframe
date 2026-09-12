import { useCallback, useEffect, useRef, useState } from "react";
import { FlipHorizontal, RotateCcw, RotateCw, ScanFace, SunMedium, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { FaceSetBuilder } from "@/components/comic/face-set-builder";
import { FaceThumb } from "@/components/comic/face-thumb";
import { ImageStage, OvalMarks } from "@/components/comic/image-stage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFaceSetStore } from "@/lib/comics/face-sets";
import { loadImageElement, normalizeDeg, paintPanelWithFaces } from "@/lib/comics/faces";
import { putMedia, resolveMediaUrl, useMediaUrl } from "@/lib/comics/media";
import { useComicStore } from "@/lib/comics/store";
import type { FaceSetFace, NormBox, Panel } from "@/lib/comics/types";
import { nid } from "@/lib/utils";

interface HeadReplacementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comicId: string;
  pageId: string;
  panel: Panel;
}

interface HeadSlot extends NormBox {
  id: string;
  faceId: string | null;
  faceSrc: string | null;
  scale: number;
  rotation: number;
  mirror: boolean;
  feather: number;
  opacity: number;
}

function defaultSlot(): HeadSlot {
  return {
    id: nid(),
    x: 0.32,
    y: 0.14,
    width: 0.36,
    height: 0.42,
    faceId: null,
    faceSrc: null,
    scale: 1,
    rotation: 0,
    mirror: false,
    feather: 0.18,
    opacity: 1,
  };
}

export function HeadReplacementDialog({
  open,
  onOpenChange,
  comicId,
  pageId,
  panel,
}: HeadReplacementDialogProps) {
  const replacePanelFace = useComicStore((s) => s.replacePanelFace);
  const resetPanelFace = useComicStore((s) => s.resetPanelFace);
  const sets = useFaceSetStore((s) => s.sets);
  const hydrateSets = useFaceSetStore((s) => s.hydrate);

  const [view, setView] = useState<"replace" | "sets">("replace");
  const [slots, setSlots] = useState<HeadSlot[]>([defaultSlot()]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [matchTone, setMatchTone] = useState(true);
  const [imgSize, setImgSize] = useState({ w: 800, h: 600 });
  const [busy, setBusy] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const panelImgRef = useRef<HTMLImageElement | null>(null);
  const faceImgsRef = useRef(new Map<string, HTMLImageElement>());
  const ownedUrlsRef = useRef<string[]>([]);
  const rafRef = useRef(0);

  const rawImageRef = panel.originalImage || panel.image;
  const resolvedImageSrc = useMediaUrl(rawImageRef);
  const hasAppliedReplacement = Boolean(
    (panel.faceReplacements && panel.faceReplacements.length > 0) ||
      (panel.originalImage && panel.originalImage !== panel.image),
  );

  const selected = slots.find((slot) => slot.id === selectedId) ?? slots[0] ?? null;
  const faceCount = sets.reduce((sum, set) => sum + set.faces.length, 0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const panelImg = panelImgRef.current;
    if (!canvas || !panelImg) return;
    paintPanelWithFaces(
      canvas,
      panelImg,
      slots.map((slot) => ({
        x: slot.x,
        y: slot.y,
        width: slot.width,
        height: slot.height,
        scale: slot.scale,
        rotation: slot.rotation,
        mirror: slot.mirror,
        feather: slot.feather,
        opacity: slot.opacity,
        matchTone,
        face: slot.faceSrc ? faceImgsRef.current.get(slot.faceSrc) ?? null : null,
      })),
    );
  }, [slots, matchTone]);

  const scheduleDraw = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      draw();
    });
  }, [draw]);

  useEffect(() => {
    if (!open) return;
    hydrateSets();
    const existing = panel.faceReplacements ?? [];
    if (existing.length > 0) {
      const restored = existing.map((item) => ({
        id: nid(),
        x: item.faceBox.x,
        y: item.faceBox.y,
        width: item.faceBox.width,
        height: item.faceBox.height,
        faceId: item.faceId,
        faceSrc: item.replacementFaceSrc,
        scale: item.scale ?? 1,
        rotation: item.rotation ?? 0,
        mirror: item.mirror ?? false,
        feather: item.feather ?? 0.18,
        opacity: item.opacity ?? 1,
      }));
      setSlots(restored);
      setSelectedId(restored[0]?.id ?? null);
      setMatchTone(existing[existing.length - 1]?.matchTone ?? true);
    } else {
      const slot = defaultSlot();
      setSlots([slot]);
      setSelectedId(slot.id);
      setMatchTone(true);
    }
    const hasSets = useFaceSetStore.getState().sets.some((set) => set.faces.length > 0);
    setView(hasSets ? "replace" : "sets");
  }, [open, panel.id, hydrateSets]);

  useEffect(() => {
    if (!open || !resolvedImageSrc) return;
    let cancelled = false;
    loadImageElement(resolvedImageSrc)
      .then((img) => {
        if (cancelled) return;
        panelImgRef.current = img;
        setImgSize({ w: img.naturalWidth || 800, h: img.naturalHeight || 600 });
        scheduleDraw();
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load the panel image.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, resolvedImageSrc, scheduleDraw]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const srcs = Array.from(new Set(slots.map((slot) => slot.faceSrc).filter(Boolean))) as string[];
    for (const src of srcs) {
      if (faceImgsRef.current.has(src)) continue;
      resolveMediaUrl(src)
        .then(async (url) => {
          if (url.startsWith("blob:")) ownedUrlsRef.current.push(url);
          const img = await loadImageElement(url);
          if (cancelled) return;
          faceImgsRef.current.set(src, img);
          scheduleDraw();
        })
        .catch(() => {
          /* missing crop; user can pick another */
        });
    }
    scheduleDraw();
    return () => {
      cancelled = true;
    };
  }, [open, slots, scheduleDraw]);

  useEffect(() => {
    if (open) return;
    ownedUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    ownedUrlsRef.current = [];
    faceImgsRef.current.clear();
    panelImgRef.current = null;
  }, [open]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  function patchSlot(id: string, patch: Partial<HeadSlot>) {
    setSlots((prev) => prev.map((slot) => (slot.id === id ? { ...slot, ...patch } : slot)));
  }

  function assignFace(face: FaceSetFace) {
    if (!selected) return;
    patchSlot(selected.id, { faceId: face.id, faceSrc: face.src });
  }

  async function handleApply() {
    const canvas = canvasRef.current;
    if (!canvas || !panelImgRef.current) return;
    const ready = slots.filter((slot) => slot.faceSrc);
    if (ready.length === 0) {
      toast.error("Pick a marked face first.");
      return;
    }
    setBusy(true);
    try {
      draw();
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92),
      );
      if (!blob) throw new Error("Could not encode the panel");
      const mediaRef = await putMedia(blob);
      replacePanelFace(
        comicId,
        pageId,
        panel.id,
        mediaRef,
        ready.map((slot) => ({
          faceId: slot.faceId || slot.id,
          faceBox: { x: slot.x, y: slot.y, width: slot.width, height: slot.height },
          replacementFaceSrc: slot.faceSrc!,
          scale: slot.scale,
          rotation: slot.rotation,
          mirror: slot.mirror,
          feather: slot.feather,
          opacity: slot.opacity,
          matchTone,
        })),
      );
      toast.success("Head replacement saved.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not apply that head.");
    } finally {
      setBusy(false);
    }
  }

  function handleReset() {
    resetPanelFace(comicId, pageId, panel.id);
    toast.success("Original panel restored.");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="gap-3 border-b border-border px-5 py-4 pr-12">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <DialogTitle className="font-display text-xl tracking-wide text-primary">
                {view === "sets" ? "Face sets" : "Replace head"}
              </DialogTitle>
              <DialogDescription>
                {view === "sets"
                  ? "Upload a photo and mark each head. Those crops are the only faces available to drop onto a panel."
                  : "Place the ring over a head, pick a marked face, then rotate or mirror to match the pose."}
              </DialogDescription>
            </div>
            <Tabs value={view} onValueChange={(value) => setView(value as "replace" | "sets")}>
              <TabsList>
                <TabsTrigger value="replace">Replace</TabsTrigger>
                <TabsTrigger value="sets">Face sets</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4">
          {view === "sets" ? (
            <FaceSetBuilder
              panelImageUrl={resolvedImageSrc}
              onCreated={(faces) => {
                if (faces[0] && selected) assignFace(faces[0]);
                setView("replace");
              }}
            />
          ) : (
            <div className="grid min-h-0 gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="flex min-h-0 flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Panel · scroll to zoom · drag the box, corners resize, stem rotates
                  </p>
                  <div className="flex gap-1.5">
                    {slots.length > 1 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (!selected || slots.length < 2) return;
                          const next = slots.filter((slot) => slot.id !== selected.id);
                          setSlots(next);
                          setSelectedId(next[0]?.id ?? null);
                        }}
                      >
                        Remove
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const slot = defaultSlot();
                        setSlots((prev) => [...prev, slot]);
                        setSelectedId(slot.id);
                      }}
                    >
                      Add target
                    </Button>
                  </div>
                </div>
                <ImageStage imgW={imgSize.w} imgH={imgSize.h} className="aspect-square rounded-lg">
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 h-full w-full object-fill pointer-events-none"
                  />
                  <OvalMarks
                    boxes={slots.map((slot, index) => ({
                      ...slot,
                      label: `Head ${index + 1}`,
                      rotation: slot.rotation,
                    }))}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onChange={(id, next) => patchSlot(id, next)}
                    onRotate={(id, rotation) => patchSlot(id, { rotation })}
                  />
                </ImageStage>
              </div>

              <div className="flex min-h-0 flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Your faces
                  </p>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setView("sets")}>
                    <ScanFace className="size-4" />
                    Manage sets
                  </Button>
                </div>

                {faceCount === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-secondary/40 px-4 py-10 text-center">
                    <UserRound className="size-8 text-primary" />
                    <div className="space-y-1">
                      <p className="font-medium">No faces yet</p>
                      <p className="text-sm text-muted-foreground">
                        Mark heads on a photo to build a set you can drop onto this panel.
                      </p>
                    </div>
                    <Button type="button" onClick={() => setView("sets")}>
                      Mark faces from a photo
                    </Button>
                  </div>
                ) : (
                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                    {sets.map((set) =>
                      set.faces.length === 0 ? null : (
                        <section key={set.id} className="space-y-2">
                          <p className="text-sm font-medium text-foreground">{set.name}</p>
                          <div className="grid grid-cols-3 gap-2">
                            {set.faces.map((face) => {
                              const active = selected?.faceId === face.id || selected?.faceSrc === face.src;
                              return (
                                <button
                                  key={face.id}
                                  type="button"
                                  data-face-pick
                                  onClick={() => assignFace(face)}
                                  className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-colors ${
                                    active
                                      ? "border-primary bg-primary/10 ring-2 ring-primary/25"
                                      : "border-border bg-card hover:border-primary/50"
                                  }`}
                                >
                                  <FaceThumb
                                    src={face.src}
                                    alt={face.name}
                                    className="size-16 rounded-lg border border-border object-contain bg-secondary transition-transform duration-150 ease-out"
                                    style={
                                      active
                                        ? {
                                            transform: `rotate(${selected?.rotation ?? 0}deg) scaleX(${selected?.mirror ? -1 : 1})`,
                                          }
                                        : undefined
                                    }
                                  />
                                  <span className="w-full truncate text-center text-xs font-medium">
                                    {face.name}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </section>
                      ),
                    )}
                  </div>
                )}

                {selected ? (
                  <div className="space-y-3 rounded-lg border border-border bg-secondary/50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                        Scale
                      </Label>
                      <span className="font-mono text-xs text-primary">
                        {Math.round(selected.scale * 100)}%
                      </span>
                    </div>
                    <Slider
                      min={0.55}
                      max={1.8}
                      step={0.02}
                      value={[selected.scale]}
                      onValueChange={([value]) => {
                        if (typeof value === "number") patchSlot(selected.id, { scale: value });
                      }}
                    />
                    <div className="flex items-center justify-between gap-3">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                        Rotate
                      </Label>
                      <span className="font-mono text-xs text-primary">
                        {Math.round(selected.rotation)}°
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="size-9 shrink-0"
                        aria-label="Rotate left 15 degrees"
                        onClick={() =>
                          patchSlot(selected.id, {
                            rotation: normalizeDeg(selected.rotation - 15),
                          })
                        }
                      >
                        <RotateCcw className="size-4" />
                      </Button>
                      <Slider
                        min={-180}
                        max={180}
                        step={1}
                        value={[selected.rotation]}
                        onValueChange={([value]) => {
                          if (typeof value === "number") {
                            patchSlot(selected.id, { rotation: normalizeDeg(value) });
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="size-9 shrink-0"
                        aria-label="Rotate right 15 degrees"
                        onClick={() =>
                          patchSlot(selected.id, {
                            rotation: normalizeDeg(selected.rotation + 15),
                          })
                        }
                      >
                        <RotateCw className="size-4" />
                      </Button>
                    </div>
                    {selected.rotation !== 0 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="w-full"
                        onClick={() => patchSlot(selected.id, { rotation: 0 })}
                      >
                        Straighten
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant={selected.mirror ? "default" : "outline"}
                      className="w-full"
                      aria-pressed={selected.mirror}
                      onClick={() => patchSlot(selected.id, { mirror: !selected.mirror })}
                    >
                      <FlipHorizontal className="size-4" />
                      {selected.mirror ? "Mirrored" : "Mirror face"}
                    </Button>
                    <div className="flex items-center justify-between gap-3">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                        Edge blend
                      </Label>
                      <span className="font-mono text-xs text-primary">
                        {Math.round(selected.feather * 100)}%
                      </span>
                    </div>
                    <Slider
                      min={0.08}
                      max={0.6}
                      step={0.02}
                      value={[selected.feather]}
                      onValueChange={([value]) => patchSlot(selected.id, { feather: value })}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant={matchTone ? "default" : "outline"}
                      className="w-full"
                      onClick={() => setMatchTone((value) => !value)}
                    >
                      <SunMedium className="size-4" />
                      {matchTone ? "Matching panel light" : "Match panel light"}
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {view === "replace" ? (
          <DialogFooter className="border-t border-border px-5 py-4 sm:justify-between">
            <div>
              {hasAppliedReplacement ? (
                <Button type="button" variant="destructive" size="sm" onClick={handleReset}>
                  <Trash2 className="size-4" />
                  Remove replacement
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void handleApply()} disabled={busy || faceCount === 0}>
                Save to panel
              </Button>
            </div>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
