import { useState, useMemo } from "react";
import {
  Sparkles,
  Copy,
  Check,
  Wand2,
  AlertTriangle,
  Image as ImageIcon,
  Layers,
  Camera,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useComicStore } from "@/lib/comics/store";
import { buildPanelPrompt, type PromptTarget } from "@/lib/comics/prompt-builder";
import type { Comic, Panel, ShotType } from "@/lib/comics/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comic: Comic;
  pageId: string;
  panelIndex: number;
  panel: Panel;
}

const SHOT_OPTIONS: { id: ShotType; label: string }[] = [
  { id: "establishing", label: "Establishing" },
  { id: "wide", label: "Wide" },
  { id: "medium", label: "Medium" },
  { id: "close-up", label: "Close-up" },
  { id: "extreme-close-up", label: "Extreme CU" },
  { id: "low-angle", label: "Low Angle" },
  { id: "high-angle", label: "High Angle" },
  { id: "over-shoulder", label: "Over Shoulder" },
  { id: "dutch", label: "Dutch Angle" },
];

export function PromptCopilotDialog({
  open,
  onOpenChange,
  comic,
  pageId,
  panelIndex,
  panel,
}: Props) {
  const store = useComicStore();
  const scene = panel.scene;

  // Local draft controls
  const [target, setTarget] = useState<PromptTarget>("generic");
  const [copied, setCopied] = useState(false);
  const [copiedNegative, setCopiedNegative] = useState(false);

  // Editable overrides within Copilot session
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>(scene?.characterIds ?? []);
  const [selectedBgId, setSelectedBgId] = useState<string | undefined>(scene?.backgroundId);
  const [selectedShot, setSelectedShot] = useState<ShotType | undefined>(scene?.shot);
  const [actionText, setActionText] = useState<string>(scene?.action ?? "");

  // Re-sync when panel scene or modal opens
  const characters = useMemo(
    () => Object.values(comic.assetContext?.characters ?? {}),
    [comic.assetContext?.characters],
  );
  const backgrounds = useMemo(
    () => Object.values(comic.assetContext?.backgrounds ?? {}),
    [comic.assetContext?.backgrounds],
  );

  const promptResult = useMemo(() => {
    return buildPanelPrompt(comic, pageId, panelIndex, {
      target,
      backgroundId: selectedBgId,
      characterIds: selectedCharIds,
      actionDescription: actionText,
      shot: selectedShot,
    });
  }, [comic, pageId, panelIndex, target, selectedBgId, selectedCharIds, actionText, selectedShot]);

  function handleCopy(text: string, isNeg = false) {
    void navigator.clipboard.writeText(text);
    if (isNeg) {
      setCopiedNegative(true);
      setTimeout(() => setCopiedNegative(false), 2000);
      toast.success("Negative prompt copied to clipboard!");
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(`${target.toUpperCase()} prompt copied to clipboard!`);
    }
  }

  function handleApplyToPanel() {
    store.setPanelScene(comic.id, pageId, panel.id, {
      characterIds: selectedCharIds.length > 0 ? selectedCharIds : undefined,
      backgroundId: selectedBgId || undefined,
      shot: selectedShot,
      action: actionText.trim() || undefined,
    });
    toast.success("Saved scene continuity specs to panel.");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92dvh] overflow-hidden flex flex-col p-4 sm:p-6 bg-card border-border shadow-2xl">
        <DialogHeader className="shrink-0 border-b border-border/80 pb-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2.5 text-base sm:text-lg font-display uppercase tracking-wide">
              <span className="flex size-7 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/30">
                <Wand2 className="size-4" />
              </span>
              AI Prompt Copilot • Panel {panelIndex + 1}
            </DialogTitle>
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
              <Layers className="size-3 text-primary" />
              <span>AR {promptResult.aspectRatio}</span>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
          {/* Target Model Selector */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Prompt Format Target
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["generic", "Generic Structured", "Universal specification"],
                  ["midjourney", "Midjourney v6", "Photorealistic --ar flags"],
                  ["flux-sd", "Flux / SDXL", "Weighted tags + negative"],
                ] as const
              ).map(([id, label, sub]) => {
                const active = target === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTarget(id)}
                    className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition-all ${
                      active
                        ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                        : "border-border bg-secondary/30 hover:border-foreground/30 hover:bg-secondary/60"
                    }`}
                  >
                    <span className="text-xs font-bold text-foreground">{label}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                      {sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Compiled Prompt Output Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" />
                Compiled Generation Prompt
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleCopy(promptResult.compiledPrompt)}
                className="h-7 px-2.5 text-xs font-semibold gap-1.5 border-primary/40 bg-primary/5 hover:bg-primary/15 text-primary"
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Copied!" : "Copy Prompt"}
              </Button>
            </div>
            <div className="relative rounded-lg border border-border bg-ink/90 p-3 font-mono text-xs leading-relaxed text-zinc-100 dark:text-zinc-200 overflow-x-auto shadow-inner min-h-24 max-h-48">
              <pre className="whitespace-pre-wrap font-sans text-xs">
                {promptResult.compiledPrompt || "No prompt generated."}
              </pre>
            </div>
          </div>

          {/* Negative prompt if Flux / SD */}
          {promptResult.negativePrompt && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Negative Prompt (Flux / SDXL)
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(promptResult.negativePrompt!, true)}
                  className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                >
                  {copiedNegative ? <Check className="size-3" /> : <Copy className="size-3" />}
                  Copy Negative
                </Button>
              </div>
              <div className="rounded-md border border-border/80 bg-secondary/30 p-2 font-mono text-[11px] text-muted-foreground leading-relaxed">
                {promptResult.negativePrompt}
              </div>
            </div>
          )}

          {/* Reference Assets Strip */}
          {promptResult.referenceImages.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <ImageIcon className="size-3.5 text-primary" />
                Visual Model Sheet References ({promptResult.referenceImages.length})
              </Label>
              <div className="flex flex-wrap gap-2 pt-0.5">
                {promptResult.referenceImages.map((img, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1 text-xs shadow-2xs"
                  >
                    <span className="size-2 rounded-full bg-emerald-500" />
                    <span className="font-semibold text-foreground">{img.label}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      ({img.type})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Continuity Warnings if any */}
          {promptResult.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-500">
                <AlertTriangle className="size-3.5" />
                <span>Continuity Notice</span>
              </div>
              <ul className="list-disc list-inside text-[11px] text-amber-400/90 space-y-0.5">
                {promptResult.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Quick Scene Customization Section */}
          <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Adjust Panel Context
            </p>

            {/* Character selection chips */}
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Characters</Label>
              {characters.length === 0 ? (
                <p className="text-[11px] text-muted-foreground/80 italic">
                  No characters in Story Bible yet.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {characters.map((c) => {
                    const sel = selectedCharIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() =>
                          setSelectedCharIds((prev) =>
                            sel ? prev.filter((id) => id !== c.id) : [...prev, c.id],
                          )
                        }
                        className={`h-6 px-2.5 rounded-full border text-[11px] font-medium transition-colors ${
                          sel
                            ? "border-primary bg-primary text-primary-foreground font-semibold shadow-xs"
                            : "border-border bg-card text-foreground hover:bg-secondary"
                        }`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Setting and Camera Shot */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="copilot-bg" className="text-[11px] text-muted-foreground">
                  Location / Setting
                </Label>
                <select
                  id="copilot-bg"
                  value={selectedBgId ?? ""}
                  onChange={(e) => setSelectedBgId(e.target.value || undefined)}
                  className="h-8 w-full rounded-md border border-input bg-card px-2.5 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Unspecified location</option>
                  {backgrounds.map((bg) => (
                    <option key={bg.id} value={bg.id}>
                      {bg.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label
                  htmlFor="copilot-shot"
                  className="text-[11px] text-muted-foreground flex items-center gap-1"
                >
                  <Camera className="size-3" /> Camera Shot
                </Label>
                <select
                  id="copilot-shot"
                  value={selectedShot ?? ""}
                  onChange={(e) => setSelectedShot((e.target.value as ShotType) || undefined)}
                  className="h-8 w-full rounded-md border border-input bg-card px-2.5 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Default framing</option>
                  {SHOT_OPTIONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Action Description */}
            <div className="space-y-1">
              <Label htmlFor="copilot-action" className="text-[11px] text-muted-foreground">
                Action / Scene Prompt
              </Label>
              <Textarea
                id="copilot-action"
                value={actionText}
                onChange={(e) => setActionText(e.target.value)}
                placeholder="Describe action: e.g. Marcus hands the encrypted datapad to Elena under the flickering neon sign..."
                rows={2}
                className="text-xs resize-none"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="shrink-0 flex items-center justify-between border-t border-border pt-3 mt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Close
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleApplyToPanel}
              className="text-xs font-semibold gap-1.5"
            >
              <Check className="size-3.5" />
              Apply to Panel Scene
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => handleCopy(promptResult.compiledPrompt)}
              className="text-xs font-semibold gap-1.5 bg-primary text-primary-foreground shadow-sm"
            >
              <Copy className="size-3.5" />
              Copy & Use
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
