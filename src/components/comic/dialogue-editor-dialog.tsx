import { useMemo } from "react";
import {
  MessageCircle,
  Cloud,
  Megaphone,
  Captions,
  Zap,
  Bookmark,
  Award,
  Trash2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useComicStore } from "@/lib/comics/store";
import type { BubbleKind, SpeechBubble, TailDir } from "@/lib/comics/types";
import { SpeechBubble as SpeechBubbleComponent } from "./speech-bubble";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comicId: string;
  pageId: string;
  panelId: string;
  bubble: SpeechBubble | null;
  onDelete?: () => void;
}

const KINDS: { id: BubbleKind; label: string; icon: typeof MessageCircle; desc: string }[] = [
  {
    id: "speech",
    label: "Speech Balloon",
    icon: MessageCircle,
    desc: "Standard character dialogue bubble with tail",
  },
  {
    id: "thought",
    label: "Thought Cloud",
    icon: Cloud,
    desc: "Pondering thought bubble with cloud dots",
  },
  { id: "shout", label: "Shout Burst", icon: Megaphone, desc: "Jagged loud shout explosion" },
  {
    id: "caption",
    label: "Narrative Caption",
    icon: Captions,
    desc: "Top or bottom rectangular narrative box",
  },
  { id: "sfx", label: "Action SFX", icon: Zap, desc: "Bold 3D angled action sound effect text" },
  {
    id: "title-banner",
    label: "Scene Banner",
    icon: Bookmark,
    desc: "Yellow comic chapter / scene headline banner",
  },
  {
    id: "burst-label",
    label: "Starburst Badge",
    icon: Award,
    desc: "Action starburst badge for callouts",
  },
];

const TAILS: { id: TailDir; label: string }[] = [
  { id: "bl", label: "Bottom Left" },
  { id: "br", label: "Bottom Right" },
  { id: "tl", label: "Top Left" },
  { id: "tr", label: "Top Right" },
  { id: "none", label: "No Tail" },
];

const SFX_QUICK_PRESETS = [
  "KAPOW!",
  "BOOM!",
  "ZAP!",
  "BAM!",
  "WHOOSH!",
  "CRASH!",
  "MEANWHILE...",
  "SUDDENLY...",
  "SPECIAL!",
  "TO BE CONTINUED...",
];

export function DialogueEditorDialog({
  open,
  onOpenChange,
  comicId,
  pageId,
  panelId,
  bubble,
  onDelete,
}: Props) {
  const store = useComicStore();
  const comic = useComicStore((s) => s.comics.find((c) => c.id === comicId));
  const page = comic?.pages.find((p) => p.id === pageId);
  const panel = page?.panels.find((p) => p.id === panelId);

  const allCharacters = useMemo(
    () => Object.values(comic?.assetContext?.characters ?? {}),
    [comic?.assetContext?.characters],
  );

  const panelCharIds = useMemo(
    () => new Set(panel?.scene?.characterIds ?? []),
    [panel?.scene?.characterIds],
  );

  const sortedCharacters = useMemo(() => {
    return [...allCharacters].sort((a, b) => {
      const aInPanel = panelCharIds.has(a.id);
      const bInPanel = panelCharIds.has(b.id);
      if (aInPanel && !bInPanel) return -1;
      if (!aInPanel && bInPanel) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [allCharacters, panelCharIds]);

  const currentSpeaker = bubble?.speakerId
    ? comic?.assetContext?.characters?.[bubble.speakerId]
    : null;

  if (!bubble) return null;

  function update(patch: Partial<SpeechBubble>) {
    if (!bubble) return;
    store.updateBubble(comicId, pageId, panelId, bubble.id, patch);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90dvh] overflow-hidden flex flex-col p-4 sm:p-6">
        <DialogHeader className="shrink-0 border-b border-border pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg font-display uppercase tracking-wide">
            <MessageCircle className="size-5 text-primary" />
            Edit Dialogue & Heading Properties
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 py-2 pr-1">
          {/* Live Preview Box */}
          <div className="flex flex-col items-center justify-center bg-secondary/40 border border-border rounded-lg p-6 relative min-h-32">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest absolute top-2 left-2">
              Preview
            </p>
            <div className="relative w-full max-w-xs flex justify-center py-4">
              <SpeechBubbleComponent
                bubble={{ ...bubble, x: 0, y: 0, w: Math.max(60, bubble.w) }}
                editable={false}
              />
            </div>
          </div>

          {/* Speaker Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="bubble-speaker"
                className="text-xs font-semibold flex items-center gap-1.5"
              >
                <User className="size-3.5 text-primary" />
                Speaker Character
              </Label>
              {currentSpeaker?.voice && (
                <span
                  className="text-[10px] text-muted-foreground truncate max-w-[220px]"
                  title={currentSpeaker.voice}
                >
                  Voice: {currentSpeaker.voice}
                </span>
              )}
            </div>
            <select
              id="bubble-speaker"
              value={bubble.speakerId ?? ""}
              onChange={(e) => update({ speakerId: e.target.value || undefined })}
              className="h-8 w-full rounded-md border border-input bg-card px-2.5 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Unassigned / Narrative voice</option>
              {sortedCharacters.map((c) => {
                const inPanel = panelCharIds.has(c.id);
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} {inPanel ? "(In this panel)" : ""} {c.role ? `• ${c.role}` : ""}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Dialogue Text Input & Quick Preset Chips */}
          <div className="space-y-2">
            <Label htmlFor="bubble-modal-text" className="text-xs font-semibold">
              Dialogue / Heading Text
            </Label>
            <Textarea
              id="bubble-modal-text"
              value={bubble.text}
              onChange={(e) => update({ text: e.target.value })}
              placeholder="Type dialogue or sound effect text..."
              className="min-h-20 text-sm font-medium"
            />

            <div className="flex flex-wrap gap-1 pt-1">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase mr-1 flex items-center">
                Presets:
              </span>
              {SFX_QUICK_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => update({ text: preset })}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-border bg-card hover:bg-primary/10 hover:border-primary text-foreground transition-colors"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Balloon Style / Kind Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Style / Category</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {KINDS.map((k) => {
                const Icon = k.icon;
                const selected = bubble.kind === k.id;
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => update({ kind: k.id })}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all ${
                      selected
                        ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                        : "border-border bg-card hover:border-foreground/30"
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-md shrink-0 ${selected ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-xs text-foreground truncate">{k.label}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight line-clamp-1">
                        {k.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tail Direction Selection (Only for Speech and Thought) */}
          {bubble.kind !== "caption" &&
            bubble.kind !== "shout" &&
            bubble.kind !== "sfx" &&
            bubble.kind !== "title-banner" &&
            bubble.kind !== "burst-label" && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Tail Pointer Direction</Label>
                <div className="grid grid-cols-5 gap-1.5">
                  {TAILS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => update({ tail: t.id })}
                      className={`py-1.5 px-1 rounded-md border text-[11px] font-medium text-center truncate ${
                        bubble.tail === t.id
                          ? "border-primary bg-primary text-primary-foreground font-bold"
                          : "border-border bg-card hover:border-foreground/30"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
        </div>

        {/* Modal Footer Actions */}
        <DialogFooter className="shrink-0 flex items-center justify-between border-t border-border pt-3 mt-2 sm:justify-between">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => {
              onDelete?.();
              onOpenChange(false);
            }}
            className="gap-1.5 text-xs"
          >
            <Trash2 className="size-3.5" />
            Delete Balloon
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)} size="sm">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
