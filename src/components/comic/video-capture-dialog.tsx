import { useEffect, useRef, useState } from "react";
import { Pause, Play, Scissors, Video } from "lucide-react";
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
import { compressImage, putMedia } from "@/lib/comics/media";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSource?: File | string | null;
  onCapture: (mediaRef: string) => void;
}

export function VideoCaptureDialog({
  open,
  onOpenChange,
  initialSource,
  onCapture,
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

  useEffect(() => {
    if (!open) return;
    if (initialSource instanceof File) {
      const url = URL.createObjectURL(initialSource);
      setSrc(url);
      setOwnsUrl(true);
    } else if (typeof initialSource === "string") {
      setSrc(initialSource);
      setOwnsUrl(false);
    }
  }, [open, initialSource]);

  useEffect(() => {
    return () => {
      if (ownsUrl && src) URL.revokeObjectURL(src);
    };
  }, [ownsUrl, src]);

  function loadFile(file: File) {
    if (ownsUrl && src) URL.revokeObjectURL(src);
    const url = URL.createObjectURL(file);
    setSrc(url);
    setOwnsUrl(true);
    setPreview(null);
    setPlaying(false);
  }

  function loadSample() {
    if (ownsUrl && src) URL.revokeObjectURL(src);
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
      const url = URL.createObjectURL(blob);
      setPreview(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not grab that frame.");
    } finally {
      setBusy(false);
    }
  }

  async function useFrame() {
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

  function reset() {
    if (ownsUrl && src) URL.revokeObjectURL(src);
    if (preview) URL.revokeObjectURL(preview);
    setSrc(null);
    setOwnsUrl(false);
    setPreview(null);
    setDuration(0);
    setTime(0);
    setPlaying(false);
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

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Grab a video frame</DialogTitle>
          <DialogDescription>
            Scrub to the beat you want, then freeze it as a comic panel.
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

        {src ? (
          <div className="space-y-3">
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
                <img src={preview} alt="Captured frame preview" className="w-full" />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-secondary/50 px-4 py-10 text-center">
            <Video className="size-8 text-muted-foreground" strokeWidth={1.5} />
            <p className="max-w-sm text-sm text-muted-foreground">
              Upload a clip from your camera roll, or try the sample rain-soaked night bus.
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
        )}

        <DialogFooter>
          {src ? (
            <>
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                Different clip
              </Button>
              <Button type="button" variant="secondary" onClick={grabFrame} disabled={busy}>
                <Scissors />
                Grab frame
              </Button>
              <Button type="button" onClick={useFrame} disabled={busy}>
                Use this frame
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatTime(seconds: number) {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}
