import { useEffect, useRef, useState } from "react";
import { ArrowDownUp, Check, Clock, Images, Layers, Pause, Play, Scissors, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { SAMPLE_CLIP } from "@/lib/comics/demo";
import { LAYOUT_LIST } from "@/lib/comics/layouts";
import { compressImage, putMedia, useMediaUrl } from "@/lib/comics/media";
import type { PageLayoutId } from "@/lib/comics/types";

interface ExtractedFrame {
  id: string;
  time: number;
  blob: Blob;
  url: string;
  selected: boolean;
}

interface LibraryItem {
  id: string;
  ref: string;
  selected: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSource?: File | string | null;
  initialTab?: "video" | "library";
  onCapture: (mediaRef: string) => void;
  onBatchCapture?: (mediaRefs: string[], targetLayout?: PageLayoutId) => void;
  comicMediaRefs?: string[];
}

export function VideoCaptureDialog({
  open,
  onOpenChange,
  initialSource,
  initialTab = "video",
  onCapture,
  onBatchCapture,
  comicMediaRefs = [],
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [ownsUrl, setOwnsUrl] = useState(false);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Scheduled Batch Mode states
  const [activeTab, setActiveTab] = useState<"video" | "library">(initialTab);
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [intervalSec, setIntervalSec] = useState<number>(5);
  const [extractedFrames, setExtractedFrames] = useState<ExtractedFrame[]>([]);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [targetLayout, setTargetLayout] = useState<PageLayoutId>("two-h");
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);

  // Library Items state
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);

  useEffect(() => {
    if (!open) return;
    if (initialTab) setActiveTab(initialTab);
    if (initialSource instanceof File) {
      const url = URL.createObjectURL(initialSource);
      setSrc(url);
      setOwnsUrl(true);
    } else if (typeof initialSource === "string") {
      setSrc(initialSource);
      setOwnsUrl(false);
    }
  }, [open, initialSource, initialTab]);

  useEffect(() => {
    if (open) {
      setLibraryItems(
        comicMediaRefs.map((ref) => ({
          id: ref,
          ref,
          selected: false,
        })),
      );
    }
  }, [open, comicMediaRefs]);

  useEffect(() => {
    return () => {
      if (ownsUrl && src) URL.revokeObjectURL(src);
    };
  }, [ownsUrl, src]);

  function clearExtractedUrls() {
    for (const f of extractedFrames) {
      URL.revokeObjectURL(f.url);
    }
    setExtractedFrames([]);
  }

  function loadFile(file: File) {
    if (ownsUrl && src) URL.revokeObjectURL(src);
    clearExtractedUrls();
    const url = URL.createObjectURL(file);
    setSrc(url);
    setOwnsUrl(true);
    setPreview(null);
    setPlaying(false);
  }

  function loadSample() {
    if (ownsUrl && src) URL.revokeObjectURL(src);
    clearExtractedUrls();
    setSrc(SAMPLE_CLIP);
    setOwnsUrl(false);
    setPreview(null);
    setPlaying(false);
  }

  async function grabFrame() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      toast.error("Let the clip load first.");
      return;
    }
    video.pause();
    setPlaying(false);
    setBusy(true);
    try {
      const blob = await compressImage(video);
      if (preview) URL.revokeObjectURL(preview);
      const url = URL.createObjectURL(blob);
      setPreview(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not grab that frame.");
    } finally {
      setBusy(false);
    }
  }

  async function useSingleFrame() {
    const video = videoRef.current;
    if (!video) return;
    setBusy(true);
    try {
      const blob = await compressImage(video);
      const ref = await putMedia(blob);
      onCapture(ref);
      onOpenChange(false);
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the frame.");
    } finally {
      setBusy(false);
    }
  }

  async function extractScheduledFrames() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !duration) {
      toast.error("Please wait for the video clip to load.");
      return;
    }

    video.pause();
    setPlaying(false);
    setExtracting(true);
    setExtractProgress(0);
    clearExtractedUrls();

    const step = Math.max(1, intervalSec);
    const targetTimes: number[] = [];
    for (let t = 0; t <= duration; t += step) {
      targetTimes.push(t);
    }
    const frames: ExtractedFrame[] = [];

    try {
      for (let i = 0; i < targetTimes.length; i++) {
        const t = targetTimes[i];
        video.currentTime = t;
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            video.removeEventListener("seeked", onSeeked);
            resolve();
          };
          video.addEventListener("seeked", onSeeked, { once: true });
          setTimeout(resolve, 350);
        });

        const blob = await compressImage(video, 1200, 0.82);
        const url = URL.createObjectURL(blob);
        frames.push({
          id: crypto.randomUUID(),
          time: t,
          blob,
          url,
          selected: true,
        });

        setExtractProgress(Math.round(((i + 1) / targetTimes.length) * 100));
      }

      if (sortOrder === "desc") {
        frames.reverse();
      }
      setExtractedFrames(frames);
      toast.success(`Extracted ${frames.length} frames at every ${step}s!`);
    } catch (err) {
      toast.error(
        "Error extracting frames: " +
          (err instanceof Error ? err.message : "Unknown error"),
      );
    } finally {
      setExtracting(false);
    }
  }

  function toggleSortOrder() {
    const next = sortOrder === "asc" ? "desc" : "asc";
    setSortOrder(next);
    setExtractedFrames((prev) => [...prev].reverse());
  }

  async function importBatchFrames() {
    const selectedFrames = extractedFrames.filter((f) => f.selected);
    const selectedLib = libraryItems.filter((item) => item.selected).map((item) => item.ref);

    if (selectedFrames.length === 0 && selectedLib.length === 0) {
      toast.error("Please select at least one video frame or library image.");
      return;
    }

    setBusy(true);
    try {
      const refs: string[] = [];

      // Save extracted blobs to IDB
      for (const item of selectedFrames) {
        const ref = await putMedia(item.blob);
        refs.push(ref);
      }

      // Add selected library refs
      refs.push(...selectedLib);

      if (onBatchCapture) {
        onBatchCapture(refs, targetLayout);
      } else if (refs[0]) {
        onCapture(refs[0]);
      }
      onOpenChange(false);
      reset();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save extracted frames.",
      );
    } finally {
      setBusy(false);
    }
  }

  function toggleFrameSelected(id: string) {
    setExtractedFrames((prev) =>
      prev.map((f) => (f.id === id ? { ...f, selected: !f.selected } : f)),
    );
  }

  function setAllFramesSelected(selected: boolean) {
    setExtractedFrames((prev) => prev.map((f) => ({ ...f, selected })));
  }

  function toggleLibrarySelected(ref: string) {
    setLibraryItems((prev) =>
      prev.map((item) =>
        item.ref === ref ? { ...item, selected: !item.selected } : item,
      ),
    );
  }

  function setAllLibrarySelected(selected: boolean) {
    setLibraryItems((prev) => prev.map((item) => ({ ...item, selected })));
  }

  function reset() {
    if (ownsUrl && src) URL.revokeObjectURL(src);
    if (preview) URL.revokeObjectURL(preview);
    clearExtractedUrls();
    setSrc(null);
    setOwnsUrl(false);
    setPreview(null);
    setDuration(0);
    setTime(0);
    setPlaying(false);
    setMode("single");
    setActiveTab("video");
    setIntervalSec(5);
    setSortOrder("asc");
    setTargetLayout("two-h");
    setExtracting(false);
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  const selectedFrameCount = extractedFrames.filter((f) => f.selected).length;
  const selectedLibCount = libraryItems.filter((i) => i.selected).length;
  const totalSelectedCount = selectedFrameCount + selectedLibCount;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DialogTitle>Media & Video Frame Capture</DialogTitle>
            <div className="flex rounded-lg bg-secondary p-1 text-xs">
              <button
                type="button"
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors ${
                  activeTab === "video"
                    ? "bg-card text-foreground paper-shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("video")}
              >
                <Video className="size-3.5" />
                Video Capture
              </button>
              {comicMediaRefs.length > 0 ? (
                <button
                  type="button"
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors ${
                    activeTab === "library"
                      ? "bg-card text-foreground paper-shadow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setActiveTab("library")}
                >
                  <Images className="size-3.5" />
                  Library ({comicMediaRefs.length})
                </button>
              ) : null}
            </div>
          </div>
          <DialogDescription>
            {activeTab === "video"
              ? mode === "single"
                ? "Scrub to any moment and freeze it into a panel."
                : "Extract frames at scheduled intervals, select layout, and import into comic pages."
              : "Select existing images from your comic library to layout into Split, Grid, or custom panels."}
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) loadFile(file);
            e.target.value = "";
          }}
        />

        {activeTab === "video" ? (
          src ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex rounded-lg bg-secondary p-1 text-xs">
                  <button
                    type="button"
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors ${
                      mode === "single"
                        ? "bg-card text-foreground paper-shadow"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setMode("single")}
                  >
                    <Scissors className="size-3.5" />
                    Single Frame
                  </button>
                  <button
                    type="button"
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors ${
                      mode === "batch"
                        ? "bg-card text-foreground paper-shadow"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setMode("batch")}
                  >
                    <Layers className="size-3.5" />
                    Scheduled Batch
                  </button>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-lg bg-ink">
                <video
                  ref={videoRef}
                  src={src}
                  className="aspect-video w-full bg-ink"
                  playsInline
                  preload="auto"
                  onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
                  onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onEnded={() => setPlaying(false)}
                />
              </div>

              {mode === "single" ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={togglePlay}
                      aria-label={playing ? "Pause" : "Play"}
                    >
                      {playing ? <Pause /> : <Play className="ml-0.5" />}
                    </Button>
                    <Slider
                      min={0}
                      max={duration || 1}
                      step={0.04}
                      value={[time]}
                      onValueChange={([value]) => {
                        const video = videoRef.current;
                        if (!video) return;
                        video.currentTime = value ?? 0;
                        setTime(value ?? 0);
                      }}
                    />
                    <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">
                      {formatTime(time)}
                    </span>
                  </div>
                  {preview ? (
                    <div className="overflow-hidden rounded-md border border-border">
                      <img
                        src={preview}
                        alt="Captured frame preview"
                        className="w-full max-h-56 object-cover"
                      />
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4 rounded-xl border border-border bg-secondary/30 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <Clock className="size-4 text-primary" />
                      <span>Interval:</span>
                      <div className="flex gap-1">
                        {[2, 5, 10, 15].map((sec) => (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => setIntervalSec(sec)}
                            className={`rounded-md px-2.5 py-1 text-xs font-semibold border transition-colors ${
                              intervalSec === sec
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-card text-foreground"
                            }`}
                          >
                            {sec}s
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label htmlFor="custom-sec" className="text-xs text-muted-foreground">
                        Custom:
                      </label>
                      <input
                        id="custom-sec"
                        type="number"
                        min={1}
                        max={60}
                        value={intervalSec}
                        onChange={(e) =>
                          setIntervalSec(Math.max(1, parseInt(e.target.value) || 1))
                        }
                        className="h-8 w-16 rounded-md border border-input bg-card px-2 text-xs text-foreground"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={extractScheduledFrames}
                        disabled={extracting || busy}
                      >
                        {extracting ? `Extracting (${extractProgress}%)` : "Extract Frames"}
                      </Button>
                    </div>
                  </div>

                  {extractedFrames.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-3">
                          <span>
                            Extracted {extractedFrames.length} frames ({selectedFrameCount} selected)
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={toggleSortOrder}
                          >
                            <ArrowDownUp className="size-3" />
                            {sortOrder === "asc" ? "Timeline (0s → End)" : "Reverse (End → 0s)"}
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setAllFramesSelected(true)}
                            className="hover:underline font-medium text-foreground"
                          >
                            Select All
                          </button>
                          <span>·</span>
                          <button
                            type="button"
                            onClick={() => setAllFramesSelected(false)}
                            className="hover:underline font-medium text-foreground"
                          >
                            Deselect All
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
                        {extractedFrames.map((frame) => (
                          <div
                            key={frame.id}
                            onClick={() => toggleFrameSelected(frame.id)}
                            className={`group relative aspect-video cursor-pointer overflow-hidden rounded-lg border-2 transition-all ${
                              frame.selected
                                ? "border-primary ring-2 ring-primary/30"
                                : "border-border opacity-60 hover:opacity-100"
                            }`}
                          >
                            <img
                              src={frame.url}
                              alt={`Frame at ${formatTime(frame.time)}`}
                              className="size-full object-cover"
                            />
                            <span className="absolute bottom-1 left-1 rounded bg-black/75 px-1 py-0.5 text-[10px] tabular-nums text-white">
                              {formatTime(frame.time)}
                            </span>
                            <span
                              className={`absolute right-1 top-1 flex size-5 items-center justify-center rounded-full text-xs transition-colors ${
                                frame.selected
                                  ? "bg-primary text-white"
                                  : "bg-black/50 text-white/70"
                              }`}
                            >
                              {frame.selected ? <Check className="size-3" /> : null}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Target Layout Choice */}
                      <div className="space-y-2 pt-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Target Page Layout for Batch Import
                        </p>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                          {LAYOUT_LIST.slice(0, 6).map((layout) => (
                            <button
                              key={layout.id}
                              type="button"
                              onClick={() => setTargetLayout(layout.id)}
                              className={`flex flex-col items-center justify-center rounded-lg border p-1.5 text-center text-xs transition-all ${
                                targetLayout === layout.id
                                  ? "border-primary bg-primary/10 font-medium text-primary"
                                  : "border-border bg-card text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              <span className="font-semibold">{layout.label}</span>
                              <span className="text-[10px] opacity-75">
                                {layout.panelCount} {layout.panelCount === 1 ? "panel" : "panels"}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-secondary/50 px-4 py-10 text-center">
              <Video className="size-8 text-muted-foreground" strokeWidth={1.5} />
              <p className="max-w-sm text-sm text-muted-foreground">
                Upload a clip from your device or try the sample rain-soaked night bus.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" onClick={() => fileRef.current?.click()}>
                  Upload video
                </Button>
                <Button type="button" variant="outline" onClick={loadSample}>
                  Use sample clip
                </Button>
              </div>
            </div>
          )
        ) : (
          <div className="space-y-4 rounded-xl border border-border bg-secondary/30 p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {libraryItems.length} images in library ({selectedLibCount} selected)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAllLibrarySelected(true)}
                  className="hover:underline font-medium text-foreground"
                >
                  Select All
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => setAllLibrarySelected(false)}
                  className="hover:underline font-medium text-foreground"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
              {libraryItems.map((item) => (
                <LibraryItemCard
                  key={item.id}
                  item={item}
                  onToggle={() => toggleLibrarySelected(item.ref)}
                />
              ))}
            </div>

            <div className="space-y-2 pt-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Target Page Layout for Selected Library Images
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {LAYOUT_LIST.slice(0, 6).map((layout) => (
                  <button
                    key={layout.id}
                    type="button"
                    onClick={() => setTargetLayout(layout.id)}
                    className={`flex flex-col items-center justify-center rounded-lg border p-1.5 text-center text-xs transition-all ${
                      targetLayout === layout.id
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="font-semibold">{layout.label}</span>
                    <span className="text-[10px] opacity-75">
                      {layout.panelCount} {layout.panelCount === 1 ? "panel" : "panels"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {activeTab === "video" && src ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
              >
                Different clip
              </Button>
              {mode === "single" ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={grabFrame}
                    disabled={busy}
                  >
                    <Scissors className="size-4" />
                    Grab frame
                  </Button>
                  <Button type="button" onClick={useSingleFrame} disabled={busy}>
                    Use this frame
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  onClick={importBatchFrames}
                  disabled={busy || totalSelectedCount === 0}
                >
                  Import {totalSelectedCount} Selected Frame{totalSelectedCount === 1 ? "" : "s"}
                </Button>
              )}
            </>
          ) : activeTab === "library" ? (
            <Button
              type="button"
              onClick={importBatchFrames}
              disabled={busy || totalSelectedCount === 0}
            >
              Import {totalSelectedCount} Selected Image{totalSelectedCount === 1 ? "" : "s"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LibraryItemCard({
  item,
  onToggle,
}: {
  item: LibraryItem;
  onToggle: () => void;
}) {
  const url = useMediaUrl(item.ref);
  return (
    <div
      onClick={onToggle}
      className={`group relative aspect-square cursor-pointer overflow-hidden rounded-lg border-2 transition-all ${
        item.selected
          ? "border-primary ring-2 ring-primary/30"
          : "border-border opacity-70 hover:opacity-100"
      }`}
    >
      {url ? (
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <div className="size-full bg-secondary" />
      )}
      <span
        className={`absolute right-1 top-1 flex size-5 items-center justify-center rounded-full text-xs transition-colors ${
          item.selected ? "bg-primary text-white" : "bg-black/50 text-white/70"
        }`}
      >
        {item.selected ? <Check className="size-3" /> : null}
      </span>
    </div>
  );
}

function formatTime(seconds: number) {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}
