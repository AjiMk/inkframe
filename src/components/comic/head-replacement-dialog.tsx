import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEFAULT_FACE_SET, type ReplacementFace } from "@/lib/comics/faces";
import { putMedia, useMediaUrl } from "@/lib/comics/media";
import { useComicStore } from "@/lib/comics/store";
import type { Panel } from "@/lib/comics/types";
import {
  Maximize2,
  Move,
  Plus,
  RotateCcw,
  Sparkles,
  Upload,
  UserCheck,
  ZoomIn,
} from "lucide-react";
import { toast } from "sonner";

interface HeadReplacementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comicId: string;
  pageId: string;
  panel: Panel;
}

interface FaceTarget {
  id: string;
  x: number;      // 0..1 relative to image width
  y: number;      // 0..1 relative to image height
  width: number;  // 0..1 relative to image width
  height: number; // 0..1 relative to image height
}

interface ImageDisplayRect {
  offsetX: number;
  offsetY: number;
  drawW: number;
  drawH: number;
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

  const [targets, setTargets] = useState<FaceTarget[]>([
    { id: "head-target-1", x: 0.3, y: 0.18, width: 0.4, height: 0.45 },
  ]);
  const [selectedTargetId, setSelectedTargetId] = useState<string>("head-target-1");
  const [selectedFace, setSelectedFace] = useState<ReplacementFace>(DEFAULT_FACE_SET[0]);
  const [customFaces, setCustomFaces] = useState<ReplacementFace[]>([]);
  const [scale, setScale] = useState(1.0);
  const [imgSize, setImgSize] = useState<{ w: number; h: number }>({ w: 800, h: 600 });
  const [displayRect, setDisplayRect] = useState<ImageDisplayRect>({
    offsetX: 0,
    offsetY: 0,
    drawW: 400,
    drawH: 400,
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<"move" | "resize-se" | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const rawImageRef = panel.originalImage || panel.image;
  const resolvedImageSrc = useMediaUrl(rawImageRef);

  // Compute exact image display rect to prevent letterbox offset errors
  const updateDisplayRect = (imgW: number, imgH: number) => {
    if (!containerRef.current) return;
    const containerW = containerRef.current.clientWidth;
    const containerH = containerRef.current.clientHeight;

    const imgAspect = imgW / imgH;
    const containerAspect = containerW / containerH;

    let drawW = containerW;
    let drawH = containerH;
    let offsetX = 0;
    let offsetY = 0;

    if (imgAspect > containerAspect) {
      drawH = containerW / imgAspect;
      offsetY = (containerH - drawH) / 2;
    } else {
      drawW = containerH * imgAspect;
      offsetX = (containerW - drawW) / 2;
    }

    setDisplayRect({ offsetX, offsetY, drawW, drawH });
  };

  // Load image & calculate dimensions
  useEffect(() => {
    if (!open || !resolvedImageSrc) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = resolvedImageSrc;

    img.onload = () => {
      const w = img.naturalWidth || 800;
      const h = img.naturalHeight || 600;
      setImgSize({ w, h });
      updateDisplayRect(w, h);

      // Auto center initial target box
      setTargets([
        {
          id: "head-target-1",
          x: 0.3,
          y: 0.18,
          width: 0.4,
          height: 0.44,
        },
      ]);
      setSelectedTargetId("head-target-1");
    };
  }, [open, resolvedImageSrc]);

  // Handle window resize for exact coordinate alignment
  useEffect(() => {
    const handleResize = () => {
      if (imgSize.w && imgSize.h) {
        updateDisplayRect(imgSize.w, imgSize.h);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [imgSize]);

  // Render composite image & replacement head on canvas
  useEffect(() => {
    if (!open || !resolvedImageSrc) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = resolvedImageSrc;

    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = imgSize.w;
      canvas.height = imgSize.h;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const activeTarget = targets.find((t) => t.id === selectedTargetId);
      if (activeTarget && selectedFace) {
        const faceImg = new Image();
        faceImg.crossOrigin = "anonymous";
        faceImg.src = selectedFace.src;

        faceImg.onload = () => {
          const targetX = activeTarget.x * canvas.width;
          const targetY = activeTarget.y * canvas.height;
          const targetW = activeTarget.width * canvas.width * scale;
          const targetH = activeTarget.height * canvas.height * scale;

          const drawX = targetX - (targetW - activeTarget.width * canvas.width) / 2;
          const drawY = targetY - (targetH - activeTarget.height * canvas.height) / 2;

          ctx.save();
          ctx.beginPath();
          ctx.ellipse(
            drawX + targetW / 2,
            drawY + targetH / 2,
            targetW / 2,
            targetH / 2,
            0,
            0,
            2 * Math.PI,
          );
          ctx.clip();
          ctx.drawImage(faceImg, drawX, drawY, targetW, targetH);
          ctx.restore();
        };
      }
    };
  }, [open, resolvedImageSrc, imgSize, targets, selectedTargetId, selectedFace, scale]);

  // Drag to reposition or resize target box
  const handleMouseDown = (e: React.MouseEvent, targetId: string, mode: "move" | "resize-se") => {
    e.stopPropagation();
    setSelectedTargetId(targetId);
    setIsDragging(true);
    setDragMode(mode);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart || !selectedTargetId || displayRect.drawW === 0) return;

    const dxRel = (e.clientX - dragStart.x) / displayRect.drawW;
    const dyRel = (e.clientY - dragStart.y) / displayRect.drawH;

    setTargets((prev) =>
      prev.map((t) => {
        if (t.id !== selectedTargetId) return t;
        if (dragMode === "move") {
          return {
            ...t,
            x: Math.max(0, Math.min(1 - t.width, t.x + dxRel)),
            y: Math.max(0, Math.min(1 - t.height, t.y + dyRel)),
          };
        } else if (dragMode === "resize-se") {
          return {
            ...t,
            width: Math.max(0.1, Math.min(1 - t.x, t.width + dxRel)),
            height: Math.max(0.1, Math.min(1 - t.y, t.height + dyRel)),
          };
        }
        return t;
      }),
    );

    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragMode(null);
    setDragStart(null);
  };

  // Click anywhere on container to move center of active face box
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    const mouseXInDraw = e.clientX - rect.left - displayRect.offsetX;
    const mouseYInDraw = e.clientY - rect.top - displayRect.offsetY;

    if (
      mouseXInDraw < 0 ||
      mouseXInDraw > displayRect.drawW ||
      mouseYInDraw < 0 ||
      mouseYInDraw > displayRect.drawH
    ) {
      return;
    }

    const clickRelX = mouseXInDraw / displayRect.drawW;
    const clickRelY = mouseYInDraw / displayRect.drawH;

    setTargets((prev) =>
      prev.map((t) => {
        if (t.id !== selectedTargetId) return t;
        return {
          ...t,
          x: Math.max(0, Math.min(1 - t.width, clickRelX - t.width / 2)),
          y: Math.max(0, Math.min(1 - t.height, clickRelY - t.height / 2)),
        };
      }),
    );
  };

  const handleAddTarget = () => {
    const newTarget: FaceTarget = {
      id: `target-${Date.now()}`,
      x: 0.3,
      y: 0.2,
      width: 0.35,
      height: 0.4,
    };
    setTargets((prev) => [...prev, newTarget]);
    setSelectedTargetId(newTarget.id);
    toast.success("New head target box created.");
  };

  const handleCustomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      if (!src) return;
      const customItem: ReplacementFace = {
        id: `custom-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ""),
        category: "custom",
        src,
      };
      setCustomFaces((prev) => [customItem, ...prev]);
      setSelectedFace(customItem);
      toast.success("Custom replacement head uploaded!");
    };
    reader.readAsDataURL(file);
  };

  const handleApply = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedTargetId) return;

    const activeTarget = targets.find((t) => t.id === selectedTargetId);
    if (!activeTarget) return;

    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92),
      );
      if (!blob) throw new Error("Could not encode composite image");

      const newMediaRef = await putMedia(blob);

      replacePanelFace(comicId, pageId, panel.id, newMediaRef, {
        faceId: selectedFace.id,
        faceBox: activeTarget,
        replacementFaceSrc: selectedFace.src,
        scale,
      });

      toast.success("Pixel-accurate head replacement applied!");
      onOpenChange(false);
    } catch (err) {
      console.error("Apply head replacement error:", err);
      toast.error("Failed to apply face replacement");
    }
  };

  const handleReset = () => {
    resetPanelFace(comicId, pageId, panel.id);
    toast.success("Restored original panel face.");
    onOpenChange(false);
  };

  const allFaces = [...customFaces, ...DEFAULT_FACE_SET];
  const activeTarget = targets.find((t) => t.id === selectedTargetId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-stone-900 border-stone-800 text-stone-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold font-comic tracking-wide text-amber-400">
            <Sparkles className="w-5 h-5 text-amber-400" />
            Precision Head Target & Face Replacement
          </DialogTitle>
          <DialogDescription className="text-stone-400">
            Drag the target box or use the corner handle to align the head box 100% accurately over any character head.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-4">
          {/* Canvas Live Preview & Pixel-Aligned Drag Handles */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-300 uppercase tracking-wider flex items-center gap-1">
                <Move className="w-3.5 h-3.5 text-amber-400" /> Drag Box or Corners to Align
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddTarget}
                className="h-6 text-[11px] px-2 border-stone-700 text-amber-300 hover:bg-stone-800"
              >
                <Plus className="w-3 h-3 mr-1" /> Add Target Box
              </Button>
            </div>

            <div
              ref={containerRef}
              onClick={handleContainerClick}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="relative aspect-square rounded-lg border border-stone-800 bg-stone-950 overflow-hidden flex items-center justify-center p-2 cursor-crosshair select-none"
            >
              <canvas ref={canvasRef} className="max-w-full max-h-full object-contain rounded" />

              {/* Exact Aspect-Ratio Aligned Target Boxes */}
              {targets.map((t, idx) => {
                const isSelected = selectedTargetId === t.id;
                const boxLeft = displayRect.offsetX + t.x * displayRect.drawW;
                const boxTop = displayRect.offsetY + t.y * displayRect.drawH;
                const boxWidth = t.width * displayRect.drawW;
                const boxHeight = t.height * displayRect.drawH;

                return (
                  <div
                    key={t.id}
                    onMouseDown={(e) => handleMouseDown(e, t.id, "move")}
                    style={{
                      left: `${boxLeft}px`,
                      top: `${boxTop}px`,
                      width: `${boxWidth}px`,
                      height: `${boxHeight}px`,
                    }}
                    className={`absolute rounded-full border-2 cursor-move transition-shadow duration-100 flex items-center justify-center ${
                      isSelected
                        ? "border-amber-400 bg-amber-400/20 shadow-xl shadow-amber-500/30"
                        : "border-cyan-400/70 hover:border-cyan-400 bg-cyan-400/10"
                    }`}
                  >
                    <span className="text-[10px] font-bold bg-stone-900/90 text-amber-300 px-1.5 py-0.5 rounded border border-stone-700 pointer-events-none">
                      Head #{idx + 1}
                    </span>

                    {/* Corner Resize Handle */}
                    {isSelected && (
                      <div
                        onMouseDown={(e) => handleMouseDown(e, t.id, "resize-se")}
                        className="absolute bottom-0 right-0 w-4 h-4 bg-amber-400 rounded-full border-2 border-stone-900 cursor-se-resize flex items-center justify-center transform translate-x-1 translate-y-1 shadow-md hover:scale-125 transition-transform"
                        title="Drag to resize target box"
                      >
                        <Maximize2 className="w-2.5 h-2.5 text-stone-950" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Target Controls */}
            {activeTarget && (
              <div className="flex items-center justify-between text-xs bg-stone-950 p-2 rounded-lg border border-stone-800">
                <div className="flex items-center gap-2">
                  <span className="text-stone-400">Target Box:</span>
                  <div className="flex gap-1">
                    {targets.map((t, idx) => (
                      <Button
                        key={t.id}
                        size="sm"
                        variant={selectedTargetId === t.id ? "default" : "outline"}
                        className={`h-6 text-[11px] px-2 ${
                          selectedTargetId === t.id ? "bg-amber-500 text-stone-950 hover:bg-amber-400" : ""
                        }`}
                        onClick={() => setSelectedTargetId(t.id)}
                      >
                        #{idx + 1}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-stone-400">Box Width:</span>
                  <input
                    type="range"
                    min="0.1"
                    max="0.8"
                    step="0.02"
                    value={activeTarget.width}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setTargets((prev) =>
                        prev.map((t) =>
                          t.id === selectedTargetId ? { ...t, width: val, height: val * 1.1 } : t,
                        ),
                      );
                    }}
                    className="w-20 accent-amber-400"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Replacement Face Set Gallery */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-300 uppercase tracking-wider">
                Available Face Set
              </span>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCustomUpload}
                  className="hidden"
                />
                <span className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-medium">
                  <Upload className="w-3.5 h-3.5" /> Upload Custom Head
                </span>
              </label>
            </div>

            <Tabs defaultValue="all" className="w-full">
              <TabsList className="bg-stone-950 border border-stone-800 w-full justify-start">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                <TabsTrigger value="comic" className="text-xs">Comic</TabsTrigger>
                <TabsTrigger value="cartoon" className="text-xs">Cartoon</TabsTrigger>
                <TabsTrigger value="emoji" className="text-xs">Emoji</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-3">
                <div className="grid grid-cols-3 gap-3 max-h-56 overflow-y-auto p-1">
                  {allFaces.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedFace(item)}
                      className={`flex flex-col items-center p-2 rounded-lg border transition-all ${
                        selectedFace?.id === item.id
                          ? "border-amber-400 bg-amber-400/10"
                          : "border-stone-800 bg-stone-950 hover:border-stone-700"
                      }`}
                    >
                      <img src={item.src} alt={item.name} className="w-12 h-12 object-contain" />
                      <span className="text-[11px] font-medium text-stone-300 truncate w-full text-center mt-1">
                        {item.name}
                      </span>
                    </button>
                  ))}
                </div>
              </TabsContent>

              {["comic", "cartoon", "emoji"].map((cat) => (
                <TabsContent key={cat} value={cat} className="mt-3">
                  <div className="grid grid-cols-3 gap-3 max-h-56 overflow-y-auto p-1">
                    {allFaces
                      .filter((f) => f.category === cat)
                      .map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setSelectedFace(item)}
                          className={`flex flex-col items-center p-2 rounded-lg border transition-all ${
                            selectedFace?.id === item.id
                              ? "border-amber-400 bg-amber-400/10"
                              : "border-stone-800 bg-stone-950 hover:border-stone-700"
                          }`}
                        >
                          <img src={item.src} alt={item.name} className="w-12 h-12 object-contain" />
                          <span className="text-[11px] font-medium text-stone-300 truncate w-full text-center mt-1">
                            {item.name}
                          </span>
                        </button>
                      ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            {/* Replacement Head Fine Scale */}
            <div className="flex flex-col gap-2 bg-stone-950 p-3 rounded-lg border border-stone-800">
              <div className="flex justify-between items-center text-xs text-stone-300">
                <span className="flex items-center gap-1">
                  <ZoomIn className="w-3.5 h-3.5 text-stone-400" /> Replacement Head Zoom & Scale
                </span>
                <span className="font-mono text-amber-400">{Math.round(scale * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.2"
                step="0.05"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 border-t border-stone-800 pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="border-stone-700 text-stone-300 hover:bg-stone-800"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Reset Original Face
          </Button>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="border-stone-700 text-stone-300 hover:bg-stone-800"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold"
            >
              <UserCheck className="w-4 h-4 mr-1.5" />
              Apply Head Replacement
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
