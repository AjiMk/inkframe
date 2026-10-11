import { ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { AREA_NAMES, LAYOUTS } from "@/lib/comics/layouts";
import { useMediaUrl } from "@/lib/comics/media";
import type {
  CharacterReference,
  Page,
  Panel,
  SpeechBubble as SpeechBubbleData,
} from "@/lib/comics/types";
import { SpeechBubble } from "./speech-bubble";

export interface RevealState {
  panelId?: string;
  visibleBubbleIds?: string[];
  activeBubbleId?: string;
  dimOthers?: boolean;
}

interface PageCanvasProps {
  page: Page;
  mode?: "edit" | "read" | "thumb";
  selectedPanelId?: string | null;
  selectedBubbleId?: string | null;
  reveal?: RevealState;
  characters?: Record<string, CharacterReference>;
  onSelectPanel?: (panelId: string) => void;
  onSelectBubble?: (panelId: string, bubbleId: string) => void;
  onDoubleClickBubble?: (panelId: string, bubbleId: string) => void;
  onMoveBubble?: (panelId: string, bubbleId: string, x: number, y: number) => void;
  onResizeBubble?: (panelId: string, bubbleId: string, w: number) => void;
  onDropFile?: (panelId: string, file: File) => void;
  anim?: "none" | "next" | "prev";
  className?: string;
}

export function PageCanvas({
  page,
  mode = "edit",
  selectedPanelId,
  selectedBubbleId,
  reveal,
  characters,
  onSelectPanel,
  onSelectBubble,
  onDoubleClickBubble,
  onMoveBubble,
  onResizeBubble,
  onDropFile,
  anim = "none",
  className,
}: PageCanvasProps) {
  const layout = LAYOUTS[page.layout];

  return (
    <div
      className={cn(
        "page-stage relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-ink p-1.5 sm:p-2.5",
        mode === "thumb" && "pointer-events-none p-1",
        anim === "next" && "anim-page-next",
        anim === "prev" && "anim-page-prev",
        className,
      )}
    >
      <div
        className="grid h-full w-full gap-1.5 sm:gap-2"
        style={{
          gridTemplateColumns: layout.columns,
          gridTemplateRows: layout.rows,
          gridTemplateAreas: layout.areas,
        }}
      >
        {page.panels.map((panel, i) => (
          <PanelFrame
            key={panel.id}
            panel={panel}
            area={AREA_NAMES[i] ?? "a"}
            mode={mode}
            characters={characters}
            selected={selectedPanelId === panel.id}
            selectedBubbleId={selectedBubbleId}
            reveal={reveal}
            onSelectPanel={onSelectPanel}
            onSelectBubble={onSelectBubble}
            onDoubleClickBubble={onDoubleClickBubble}
            onMoveBubble={onMoveBubble}
            onResizeBubble={onResizeBubble}
            onDropFile={onDropFile}
          />
        ))}
      </div>
    </div>
  );
}

function PanelFrame({
  panel,
  area,
  mode,
  characters,
  selected,
  selectedBubbleId,
  reveal,
  onSelectPanel,
  onSelectBubble,
  onDoubleClickBubble,
  onMoveBubble,
  onResizeBubble,
  onDropFile,
}: {
  panel: Panel;
  area: string;
  mode: "edit" | "read" | "thumb";
  characters?: Record<string, CharacterReference>;
  selected: boolean;
  selectedBubbleId?: string | null;
  reveal?: RevealState;
  onSelectPanel?: (panelId: string) => void;
  onSelectBubble?: (panelId: string, bubbleId: string) => void;
  onDoubleClickBubble?: (panelId: string, bubbleId: string) => void;
  onMoveBubble?: (panelId: string, bubbleId: string, x: number, y: number) => void;
  onResizeBubble?: (panelId: string, bubbleId: string, w: number) => void;
  onDropFile?: (panelId: string, file: File) => void;
}) {
  const src = useMediaUrl(panel.image);
  const isFocus = !reveal?.panelId || reveal.panelId === panel.id;
  const dim = Boolean(reveal?.dimOthers && reveal.panelId && reveal.panelId !== panel.id);
  const bubbles = visibleBubbles(panel.bubbles, reveal, panel.id);

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    const file = event.target ? event.dataTransfer.files[0] : null;
    if (file && onDropFile) onDropFile(panel.id, file);
  }

  return (
    <div
      className={cn(
        "relative min-h-0 overflow-hidden rounded-[2px] bg-secondary transition-all duration-300 ease-out",
        selected && mode === "edit" && "ring-2 ring-primary ring-offset-2 ring-offset-ink",
        dim && "opacity-25",
        isFocus && reveal?.panelId === panel.id && mode === "read" && "anim-panel z-10",
      )}
      style={{ gridArea: area }}
      onClick={() => onSelectPanel?.(panel.id)}
      onDragOver={(e) => {
        if (mode === "edit") e.preventDefault();
      }}
      onDrop={mode === "edit" ? handleDrop : undefined}
    >
      {src ? (
        <img
          src={src}
          alt=""
          className={cn(
            "absolute inset-0 size-full object-cover",
            panel.filter !== "none" && `panel-filter-${panel.filter}`,
          )}
        />
      ) : mode === "edit" ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center text-muted-foreground">
          <ImagePlus className="size-6" strokeWidth={1.5} />
          <p className="text-xs leading-snug">
            Drop a photo, or use the tools to grab a video frame
          </p>
        </div>
      ) : (
        <div className="h-full bg-secondary" />
      )}
      {panel.filter === "halftone" || panel.filter === "pop-art" ? (
        <span className="halftone-dot pointer-events-none absolute inset-0" />
      ) : panel.filter === "manga-screentone" ? (
        <span className="screentone-dot pointer-events-none absolute inset-0" />
      ) : panel.filter === "cyber-neon" ? (
        <span className="scanlines-overlay pointer-events-none absolute inset-0" />
      ) : panel.filter === "vintage" ||
        panel.filter === "golden-pulp" ||
        panel.filter === "sepia" ? (
        <span className="vintage-grain pointer-events-none absolute inset-0" />
      ) : panel.filter === "anaglyph-3d" ? (
        <span className="anaglyph-split pointer-events-none absolute inset-0" />
      ) : null}
      {mode === "edit" && panel.scene && (panel.scene.characterIds?.length || panel.scene.shot) ? (
        <div className="pointer-events-none absolute left-1.5 top-1.5 z-20 flex max-w-[85%] flex-wrap items-center gap-1">
          {panel.scene.shot ? (
            <span className="rounded bg-black/75 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white shadow-xs backdrop-blur-xs">
              {panel.scene.shot}
            </span>
          ) : null}
          {panel.scene.characterIds?.map((charId) => {
            const char = characters?.[charId];
            const initial = char?.name
              ? char.name.charAt(0).toUpperCase()
              : charId.charAt(0).toUpperCase();
            return (
              <span
                key={charId}
                title={char?.name ?? charId}
                className="flex size-4.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground shadow-xs ring-1 ring-background/50"
              >
                {initial}
              </span>
            );
          })}
        </div>
      ) : null}
      {bubbles.map((bubble) => (
        <SpeechBubble
          key={bubble.id}
          bubble={bubble}
          editable={mode === "edit"}
          selected={selectedBubbleId === bubble.id}
          entering={mode === "read" && reveal?.visibleBubbleIds?.includes(bubble.id)}
          isActive={mode === "read" && reveal?.activeBubbleId === bubble.id}
          onSelect={() => onSelectBubble?.(panel.id, bubble.id)}
          onDoubleClick={() => onDoubleClickBubble?.(panel.id, bubble.id)}
          onMove={(x, y) => onMoveBubble?.(panel.id, bubble.id, x, y)}
          onResize={(w) => onResizeBubble?.(panel.id, bubble.id, w)}
        />
      ))}
    </div>
  );
}

function visibleBubbles(
  bubbles: SpeechBubbleData[],
  reveal: RevealState | undefined,
  panelId: string,
): SpeechBubbleData[] {
  if (!reveal) return bubbles;
  if (reveal.panelId && reveal.panelId !== panelId) return [];
  if (!reveal.visibleBubbleIds) return bubbles;
  return bubbles.filter((b) => reveal.visibleBubbleIds?.includes(b.id));
}
