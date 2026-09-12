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

interface FaceBox {
  id: string;
  x: number;      // 0..1
  y: number;      // 0..1
  width: number;  // 0..1
  height: number; // 0..1
  confidence: number;
}

// Pixel analysis to detect face region based on skin tone and contrast clusters
function detectFaceInImage(img: HTMLImageElement): FaceBox[] {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];

  const w = img.naturalWidth || 800;
  const h = img.naturalHeight || 600;
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(img, 0, 0, w, h);

  try {
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    let minX = w, maxX = 0, minY = h, maxY = 0;
    let skinPixelCount = 0;

    const step = 4;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const idx = (y * w + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Skin tone color range heuristics
        const isSkin =
          r > 60 && g > 40 && b > 20 &&
          (Math.max(r, g, b) - Math.min(r, g, b) > 15) &&
          Math.abs(r - g) > 15 && r > g && r > b;

        if (isSkin) {
          skinPixelCount++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (skinPixelCount > 40 && maxX > minX && maxY > minY) {
      const marginX = (maxX - minX) * 0.1;
      const marginY = (maxY - minY) * 0.1;
      const finalX = Math.max(0, minX - marginX) / w;
      const finalY = Math.max(0, minY - marginY) / h;
      const finalW = Math.min(w, (maxX - minX) + 2 * marginX) / w;
      const finalH = Math.min(h, (maxY - minY) + 2 * marginY) / h;

      return [
        {
          id: "face-detected-1",
          x: Math.max(0, Math.min(0.7, finalX)),
          y: Math.max(0, Math.min(0.7, finalY)),
          width: Math.max(0.15, Math.min(0.7, finalW)),
          height: Math.max(0.15, Math.min(0.7, finalH)),
          confidence: 0.95,
        },
      ];
    }
  } catch {
    // Fallback if image data is restricted
  }

  return [
    { id: "face-center", x: 0.32, y: 0.18, width: 0.36, height: 0.42, confidence: 0.9 },
  ];
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

  const [loading, setLoading] = useState(false);
  const [faces, setFaces] = useState<FaceBox[]>([]);
  const [selectedFaceId, setSelectedFaceId] = useState<string | null>(null);
  const [selectedFace, setSelectedFace] = useState<ReplacementFace>(DEFAULT_FACE_SET[0]);
  const [customFaces, setCustomFaces] = useState<ReplacementFace[]>([]);
  const [scale, setScale] = useState(1.0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const rawImageRef = panel.originalImage || panel.image;
  const resolvedImageSrc = useMediaUrl(rawImageRef);

  // Run face detection on image load
  useEffect(() => {
    if (!open || !resolvedImageSrc) return;

    setLoading(true);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = resolvedImageSrc;

    img.onload = () => {
      const detected = detectFaceInImage(img);
      setFaces(detected);
      setSelectedFaceId(detected[0].id);
      setLoading(false);
    };

    img.onerror = () => {
      const fallback: FaceBox[] = [
        { id: "face-center", x: 0.32, y: 0.18, width: 0.36, height: 0.42, confidence: 0.9 },
      ];
      setFaces(fallback);
      setSelectedFaceId("face-center");
      setLoading(false);
    };
  }, [open, resolvedImageSrc]);

  // Render canvas composite with head replacement
  useEffect(() => {
    if (!open || !resolvedImageSrc) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = resolvedImageSrc;

    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.naturalWidth || 800;
      canvas.height = img.naturalHeight || 600;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Base image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Selected replacement face
      const activeFaceBox = faces.find((f) => f.id === selectedFaceId);
      if (activeFaceBox && selectedFace) {
        const faceImg = new Image();
        faceImg.crossOrigin = "anonymous";
        faceImg.src = selectedFace.src;

        faceImg.onload = () => {
          const targetX = activeFaceBox.x * canvas.width;
          const targetY = activeFaceBox.y * canvas.height;
          const targetW = activeFaceBox.width * canvas.width * scale;
          const targetH = activeFaceBox.height * canvas.height * scale;

          const drawX = targetX - (targetW - activeFaceBox.width * canvas.width) / 2;
          const drawY = targetY - (targetH - activeFaceBox.height * canvas.height) / 2;

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
  }, [open, resolvedImageSrc, faces, selectedFaceId, selectedFace, scale]);

  // Handle clicking on canvas container to re-position target head
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;

    // Center selected face target around click position
    setFaces((prevFaces) =>
      prevFaces.map((f) => {
        if (f.id !== selectedFaceId) return f;
        const newX = Math.max(0, Math.min(1 - f.width, clickX - f.width / 2));
        const newY = Math.max(0, Math.min(1 - f.height, clickY - f.height / 2));
        return { ...f, x: newX, y: newY };
      }),
    );
  };

  const handleMouseDown = (e: React.MouseEvent, faceId: string) => {
    e.stopPropagation();
    setSelectedFaceId(faceId);
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart || !containerRef.current || !selectedFaceId) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = (e.clientX - dragStart.x) / rect.width;
    const dy = (e.clientY - dragStart.y) / rect.height;

    setFaces((prevFaces) =>
      prevFaces.map((f) => {
        if (f.id !== selectedFaceId) return f;
        return {
          ...f,
          x: Math.max(0, Math.min(1 - f.width, f.x + dx)),
          y: Math.max(0, Math.min(1 - f.height, f.y + dy)),
        };
      }),
    );
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  const handleAddFaceTarget = () => {
    const newTarget: FaceBox = {
      id: `target-${Date.now()}`,
      x: 0.35,
      y: 0.25,
      width: 0.3,
      height: 0.35,
      confidence: 1.0,
    };
    setFaces((prev) => [...prev, newTarget]);
    setSelectedFaceId(newTarget.id);
    toast.success("New face target added! Drag to position over head.");
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
    if (!canvas || !selectedFaceId) return;

    const activeFaceBox = faces.find((f) => f.id === selectedFaceId);
    if (!activeFaceBox) return;

    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.9),
      );
      if (!blob) throw new Error("Could not encode composite image");

      const newMediaRef = await putMedia(blob);

      replacePanelFace(comicId, pageId, panel.id, newMediaRef, {
        faceId: selectedFace.id,
        faceBox: activeFaceBox,
        replacementFaceSrc: selectedFace.src,
        scale,
      });

      toast.success("Accurate head replacement applied!");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-stone-900 border-stone-800 text-stone-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold font-comic tracking-wide text-amber-400">
            <Sparkles className="w-5 h-5 text-amber-400" />
            Accurate Face Target & Head Replacement
          </DialogTitle>
          <DialogDescription className="text-stone-400">
            Click or drag the target box directly onto any head in your panel to align replacement heads perfectly.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-4">
          {/* Canvas Live Preview & Drag Target Box */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-300 uppercase tracking-wider flex items-center gap-1">
                <Move className="w-3.5 h-3.5 text-amber-400" /> Drag or Click to Move Head Target
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddFaceTarget}
                className="h-6 text-[11px] px-2 border-stone-700 text-amber-300 hover:bg-stone-800"
              >
                <Plus className="w-3 h-3 mr-1" /> Add Target
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

              {/* Draggable & Selectable Face Target Overlays */}
              {faces.map((f, idx) => (
                <div
                  key={f.id}
                  onMouseDown={(e) => handleMouseDown(e, f.id)}
                  style={{
                    left: `${f.x * 100}%`,
                    top: `${f.y * 100}%`,
                    width: `${f.width * 100}%`,
                    height: `${f.height * 100}%`,
                  }}
                  className={`absolute rounded-full border-2 cursor-move transition-shadow duration-150 flex items-center justify-center ${
                    selectedFaceId === f.id
                      ? "border-amber-400 bg-amber-400/20 shadow-xl shadow-amber-500/30"
                      : "border-cyan-400/70 hover:border-cyan-400 bg-cyan-400/10"
                  }`}
                  title="Drag to reposition target head"
                >
                  <span className="text-[10px] font-bold bg-stone-900/90 text-amber-300 px-1.5 py-0.5 rounded border border-stone-700 pointer-events-none">
                    Target #{idx + 1}
                  </span>
                </div>
              ))}
            </div>

            {/* Target Selectors */}
            {faces.length > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-400">Target:</span>
                  <div className="flex gap-1.5">
                    {faces.map((f, idx) => (
                      <Button
                        key={f.id}
                        size="sm"
                        variant={selectedFaceId === f.id ? "default" : "outline"}
                        className={`h-6 text-[11px] px-2 ${
                          selectedFaceId === f.id ? "bg-amber-500 text-stone-950 hover:bg-amber-400" : ""
                        }`}
                        onClick={() => setSelectedFaceId(f.id)}
                      >
                        #{idx + 1}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Target Box Width Adjustment */}
                {selectedFaceId && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-stone-400">Target Box Size:</span>
                    <input
                      type="range"
                      min="0.1"
                      max="0.7"
                      step="0.02"
                      value={faces.find((f) => f.id === selectedFaceId)?.width ?? 0.3}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setFaces((prev) =>
                          prev.map((f) =>
                            f.id === selectedFaceId ? { ...f, width: val, height: val * 1.15 } : f,
                          ),
                        );
                      }}
                      className="w-20 accent-amber-400"
                    />
                  </div>
                )}
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
                  <ZoomIn className="w-3.5 h-3.5 text-stone-400" /> Head Zoom & Scale
                </span>
                <span className="font-mono text-amber-400">{Math.round(scale * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
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
