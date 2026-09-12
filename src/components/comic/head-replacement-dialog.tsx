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
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
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

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rawImageRef = panel.originalImage || panel.image;
  const resolvedImageSrc = useMediaUrl(rawImageRef);

  // Detect faces via server API on open
  useEffect(() => {
    if (!open || !resolvedImageSrc) return;

    let isMounted = true;
    setLoading(true);

    async function detect() {
      try {
        const res = await fetch("/api/detect-faces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: resolvedImageSrc }),
        });

        if (!res.ok) throw new Error("Server detection failed");
        const data = (await res.json()) as { faces: FaceBox[] };

        if (isMounted && data.faces && data.faces.length > 0) {
          setFaces(data.faces);
          setSelectedFaceId(data.faces[0].id);
          toast.success(`Server detected ${data.faces.length} face target(s)`);
        }
      } catch (err) {
        console.error("Server face detection error:", err);
        const fallbackFaces: FaceBox[] = [
          { id: "face-center", x: 0.28, y: 0.18, width: 0.44, height: 0.48, confidence: 0.9 },
        ];
        if (isMounted) {
          setFaces(fallbackFaces);
          setSelectedFaceId("face-center");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    detect();

    return () => {
      isMounted = false;
    };
  }, [open, resolvedImageSrc]);

  // Render composite image with head replacement on Canvas
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

      // Draw original base image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Draw selected face replacement if a face target is active
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

          // Center the replacement face over target face box
          const drawX = targetX - (targetW - activeFaceBox.width * canvas.width) / 2;
          const drawY = targetY - (targetH - activeFaceBox.height * canvas.height) / 2;

          ctx.save();
          // Clip oval mask for seamless head placement
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
      // 1. Encode composite canvas as image Blob
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.9),
      );
      if (!blob) throw new Error("Could not encode composite image");

      // 2. Save composite image to IndexedDB store
      const newMediaRef = await putMedia(blob);

      // 3. Confirm with server replacement API route
      await fetch("/api/replace-head", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetImage: rawImageRef,
          faceBox: activeFaceBox,
          replacementFaceSrc: selectedFace.src,
          scale,
        }),
      });

      // 4. Update panel in comic store
      replacePanelFace(comicId, pageId, panel.id, newMediaRef, {
        faceId: selectedFace.id,
        faceBox: activeFaceBox,
        replacementFaceSrc: selectedFace.src,
        scale,
      });

      toast.success("Head replacement applied to panel!");
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
            Server Face Detection & Head Replacement
          </DialogTitle>
          <DialogDescription className="text-stone-400">
            Detect faces in your comic panel and replace them with comic avatars or custom heads.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-4">
          {/* Canvas Live Preview & Detected Targets */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-300 uppercase tracking-wider">
                Panel Preview & Detected Faces
              </span>
              {loading && <span className="text-xs text-amber-400 animate-pulse">Server Analyzing...</span>}
            </div>

            <div className="relative aspect-square rounded-lg border border-stone-800 bg-stone-950 overflow-hidden flex items-center justify-center p-2">
              <canvas ref={canvasRef} className="max-w-full max-h-full object-contain rounded" />

              {/* Detected face selector overlays */}
              {faces.map((f, idx) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFaceId(f.id)}
                  style={{
                    left: `${f.x * 100}%`,
                    top: `${f.y * 100}%`,
                    width: `${f.width * 100}%`,
                    height: `${f.height * 100}%`,
                  }}
                  className={`absolute border-2 rounded-full transition-all duration-200 flex items-start justify-end p-1 ${
                    selectedFaceId === f.id
                      ? "border-amber-400 bg-amber-400/20 shadow-lg shadow-amber-500/20"
                      : "border-cyan-400/60 hover:border-cyan-400 hover:bg-cyan-400/10"
                  }`}
                  title={`Face Target #${idx + 1}`}
                >
                  <span className="text-[10px] font-bold bg-stone-900/90 text-amber-300 px-1 rounded border border-stone-700">
                    #{idx + 1}
                  </span>
                </button>
              ))}
            </div>

            {/* Target Face Selector */}
            {faces.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-400">Target Face:</span>
                <div className="flex gap-2">
                  {faces.map((f, idx) => (
                    <Button
                      key={f.id}
                      size="sm"
                      variant={selectedFaceId === f.id ? "default" : "outline"}
                      className={`h-7 text-xs ${
                        selectedFaceId === f.id ? "bg-amber-500 text-stone-950 hover:bg-amber-400" : ""
                      }`}
                      onClick={() => setSelectedFaceId(f.id)}
                    >
                      Target #{idx + 1}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Replacement Face Set Gallery & Options */}
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

            {/* Scale Fine Tuning */}
            <div className="flex flex-col gap-2 bg-stone-950 p-3 rounded-lg border border-stone-800">
              <div className="flex justify-between items-center text-xs text-stone-300">
                <span className="flex items-center gap-1">
                  <ZoomIn className="w-3.5 h-3.5 text-stone-400" /> Replacement Head Scale
                </span>
                <span className="font-mono text-amber-400">{Math.round(scale * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.6"
                max="1.8"
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
