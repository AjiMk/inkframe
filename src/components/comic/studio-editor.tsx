import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowDownUp,
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Copy,
  ImagePlus,
  Images,
  MessageCircle,
  Cloud,
  Megaphone,
  Captions,
  Plus,
  RotateCcw,
  ScanFace,
  Sparkles,
  Trash2,
  Video,
  Zap,
  Award,
  Bookmark,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FILTERS } from "@/lib/comics/factory";
import { compressImage, putMedia } from "@/lib/comics/media";
import { getComicMediaRefs, useComicStore } from "@/lib/comics/store";
import type { BubbleKind, PageLayoutId, Panel, TailDir } from "@/lib/comics/types";
import { HeadReplacementDialog } from "./head-replacement-dialog";
import { LayoutPicker } from "./layout-picker";
import { PageCanvas } from "./page-canvas";
import { VideoCaptureDialog } from "./video-capture-dialog";
import { CoverCanvas } from "./cover-canvas";
import { CoverDesignerDialog } from "./cover-designer-dialog";
import { DialogueEditorDialog } from "./dialogue-editor-dialog";

export function StudioEditor({ comicId }: { comicId: string }) {
  const navigate = useNavigate();
  const comic = useComicStore((s) => s.comics.find((c) => c.id === comicId));
  const hydrated = useComicStore((s) => s.hydrated);
  const store = useComicStore();

  const [pageId, setPageId] = useState<string | null>(null);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [bubbleId, setBubbleId] = useState<string | null>(null);
  const [selectedHead, setSelectedHead] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoSource, setVideoSource] = useState<File | string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draggedPageIndex, setDraggedPageIndex] = useState<number | null>(null);
  const [dragOverPageIndex, setDragOverPageIndex] = useState<number | null>(null);
  const [headReplaceOpen, setHeadReplaceOpen] = useState(false);
  const [coverDesignerOpen, setCoverDesignerOpen] = useState(false);
  const [dialogueEditorOpen, setDialogueEditorOpen] = useState(false);
  const [isCoverSelected, setIsCoverSelected] = useState(false);
  const [mediaTab, setMediaTab] = useState<"video" | "library">("video");
  const photoRef = useRef<HTMLInputElement>(null);

  const page = useMemo(
    () => comic?.pages.find((p) => p.id === pageId) ?? comic?.pages[0],
    [comic, pageId],
  );
  const panel = page?.panels.find((p) => p.id === panelId) ?? page?.panels[0];
  const bubble = panel?.bubbles.find((b) => b.id === bubbleId) ?? null;

  useEffect(() => {
    if (page && pageId !== page.id) setPageId(page.id);
  }, [page, pageId]);

  useEffect(() => {
    if (panel && !panelId) setPanelId(panel.id);
  }, [panel, panelId]);

  useEffect(() => {
    if (!pageId) return;
    const el = document.querySelector(`[data-page-id="${CSS.escape(pageId)}"]`);
    if (el instanceof HTMLElement) el.scrollIntoView({ block: "nearest" });
  }, [pageId]);

  // Backspace / Delete shortcut handler to remove selected element or replacement head
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "Backspace" || e.key === "Delete") {
        if (bubble && page && panel) {
          store.removeBubble(comicId, page.id, panel.id, bubble.id);
          setBubbleId(null);
          toast.success("Dialogue bubble removed.");
          return;
        }

        const hasHeadReplacement = Boolean(
          (panel?.faceReplacements && panel.faceReplacements.length > 0) ||
            (panel?.originalImage && panel.originalImage !== panel.image),
        );

        if (hasHeadReplacement && page && panel) {
          store.resetPanelFace(comicId, page.id, panel.id);
          setSelectedHead(false);
          toast.success("Head replacement removed via Backspace shortcut.");
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [comicId, page, panel, bubble, store]);

  async function assignImage(targetPanel: Panel, file: File) {
    if (file.type.startsWith("video/")) {
      setPanelId(targetPanel.id);
      setVideoSource(file);
      setVideoOpen(true);
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Use a photo or a video clip.");
      return;
    }
    try {
      const blob = await compressImage(file);
      const ref = await putMedia(blob);
      store.setPanelImage(comicId, page!.id, targetPanel.id, ref);
      if (!comic?.cover) store.setCover(comicId, ref);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add that image.");
    }
  }

  function addDialogue(kind: BubbleKind) {
    if (!page || !panel) return;
    const id = store.addBubble(comicId, page.id, panel.id, kind);
    setBubbleId(id);
    setDialogueEditorOpen(true);
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <header className="border-b border-border px-4 py-3">
          <p className="font-semibold">Inkframe</p>
        </header>
        <div className="mx-auto mt-10 h-[28rem] w-full max-w-md rounded-lg bg-secondary/70" />
      </div>
    );
  }

  if (!comic || !page || !panel) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-lg font-semibold">This comic is gone.</p>
        <Button asChild variant="outline">
          <Link to="/">Back to the shelf</Link>
        </Button>
      </div>
    );
  }

  const inspector = (
    <Inspector
      comicTitle={comic.title}
      comicAuthor={comic.author}
      onRename={(title, author) => store.rename(comicId, title, author)}
      onOpenCoverDesigner={() => setCoverDesignerOpen(true)}
      onOpenDialogueModal={() => setDialogueEditorOpen(true)}
      layout={page.layout}
      onLayout={(layout) => store.setLayout(comicId, page.id, layout)}
      panel={panel}
      bubble={bubble}
      onAddDialogue={addDialogue}
      onPickPhoto={() => photoRef.current?.click()}
      onPickVideo={() => {
        setVideoSource(null);
        setMediaTab("video");
        setVideoOpen(true);
      }}
      onPickLibrary={() => {
        setVideoSource(null);
        setMediaTab("library");
        setVideoOpen(true);
      }}
      selectedHead={selectedHead}
      onSelectHead={(sel) => setSelectedHead(sel)}
      onReplaceHead={() => setHeadReplaceOpen(true)}
      onResetHead={() => {
        store.resetPanelFace(comicId, page.id, panel.id);
        setSelectedHead(false);
        toast.success("Removed head replacement.");
      }}
      onClearImage={() => store.setPanelImage(comicId, page.id, panel.id, null)}
      onFilter={(filter) => store.setPanelFilter(comicId, page.id, panel.id, filter)}
      onBubblePatch={(patch) => {
        if (!bubble) return;
        store.updateBubble(comicId, page.id, panel.id, bubble.id, patch);
      }}
      onDeleteBubble={() => {
        if (!bubble) return;
        store.removeBubble(comicId, page.id, panel.id, bubble.id);
        setBubbleId(null);
      }}
    />
  );

  function handleBatchCapture(refs: string[], targetLayout: PageLayoutId = "two-h") {
    if (refs.length === 0 || !page || !comic) return;

    let refIdx = 0;

    // 1. Fill empty panels on current page
    for (const p of page.panels) {
      if (!p.image && refIdx < refs.length) {
        store.setPanelImage(comicId, page.id, p.id, refs[refIdx++]);
      }
    }

    // 2. If no panel was empty, replace selected panel with first frame
    if (refIdx === 0 && panel && refs.length > 0) {
      store.setPanelImage(comicId, page.id, panel.id, refs[refIdx++]);
    }

    // 3. Create new pages using targetLayout for remaining frames
    while (refIdx < refs.length) {
      const remaining = refs.length - refIdx;
      const layout = remaining === 1 ? "splash" : targetLayout;
      const newPageId = store.addPage(comicId, layout);

      const latestComic = useComicStore.getState().comics.find((c) => c.id === comicId);
      const newPage = latestComic?.pages.find((p) => p.id === newPageId);

      if (newPage) {
        for (const p of newPage.panels) {
          if (refIdx < refs.length) {
            store.setPanelImage(comicId, newPage.id, p.id, refs[refIdx++]);
          }
        }
      }
    }

    if (!comic.cover && refs[0]) {
      store.setCover(comicId, refs[0]);
    }

    toast.success(`Imported ${refs.length} media frame${refs.length > 1 ? "s" : ""}!`);
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="z-30 flex shrink-0 items-center gap-2 border-b border-border bg-background/90 px-3 py-2 backdrop-blur-sm sm:px-4">
        <Button asChild variant="ghost" size="icon" aria-label="Back to shelf">
          <Link to="/">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">{comic.title}</p>
          <p className="truncate text-xs text-muted-foreground">{comic.author}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCoverDesignerOpen(true)}
          className="gap-1.5 border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
        >
          <Sparkles className="size-3.5" />
          Design Cover
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="lg:hidden"
          onClick={() => setToolsOpen(true)}
        >
          Tools
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground"
          onClick={() => setConfirmDelete(true)}
          aria-label="Delete comic"
        >
          <Trash2 />
        </Button>
        <Button asChild size="sm">
          <Link to="/read/$comicId" params={{ comicId }}>
            <BookOpen />
            Read
          </Link>
        </Button>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 overflow-hidden lg:gap-4 lg:px-4 lg:py-3">
        <aside className="hidden h-full w-52 shrink-0 flex-col gap-3 overflow-hidden lg:flex">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pages
            </p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  store.reversePages(comicId);
                  toast.success("Reversed page sequence");
                }}
                title="Reverse page sequence"
                aria-label="Reverse pages"
              >
                <ArrowDownUp className="size-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7"
                onClick={() => {
                  const id = store.addPage(comicId, "two-h");
                  setPageId(id);
                  setPanelId(null);
                  setBubbleId(null);
                }}
                title="Add page"
                aria-label="Add page"
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
            <div className="flex flex-col gap-2 pb-2">
              {/* Cover Page Card */}
              <div
                className={`group relative shrink-0 overflow-hidden rounded-lg border p-1 text-left transition-all duration-150 cursor-pointer ${
                  isCoverSelected
                    ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                    : "border-border hover:border-foreground/30"
                }`}
                onClick={() => setIsCoverSelected(true)}
              >
                <CoverCanvas comic={comic} mode="thumb" />
                <div className="mt-1 flex items-center justify-between px-1">
                  <span className="text-[11px] font-bold text-primary flex items-center gap-1">
                    <Sparkles className="size-3" /> Cover
                  </span>
                  <span
                    className="text-[10px] text-primary hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCoverDesignerOpen(true);
                    }}
                  >
                    Edit Cover
                  </span>
                </div>
              </div>

              {comic.pages.map((p, i) => (
                <div
                  key={p.id}
                  data-page-id={p.id}
                  draggable
                  onDragStart={(e) => {
                    setDraggedPageIndex(i);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", String(i));
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverPageIndex !== i) setDragOverPageIndex(i);
                  }}
                  onDragLeave={() => {
                    setDragOverPageIndex(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedPageIndex !== null && draggedPageIndex !== i) {
                      store.reorderPageIndices(comicId, draggedPageIndex, i);
                      toast.success(`Moved Page ${draggedPageIndex + 1} to position ${i + 1}`);
                    }
                    setDraggedPageIndex(null);
                    setDragOverPageIndex(null);
                  }}
                  onDragEnd={() => {
                    setDraggedPageIndex(null);
                    setDragOverPageIndex(null);
                  }}
                  className={`group relative shrink-0 overflow-hidden rounded-lg border p-1 text-left transition-all duration-150 cursor-grab active:cursor-grabbing ${
                    p.id === page.id && !isCoverSelected
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border hover:border-foreground/30"
                  } ${
                    draggedPageIndex === i ? "opacity-40 scale-95" : ""
                  } ${
                    dragOverPageIndex === i && draggedPageIndex !== i
                      ? "ring-2 ring-primary border-primary bg-primary/5 scale-[1.02]"
                      : ""
                  }`}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => {
                      setIsCoverSelected(false);
                      setPageId(p.id);
                      setPanelId(p.panels[0]?.id ?? null);
                      setBubbleId(null);
                    }}
                  >
                    <PageCanvas page={p} mode="thumb" />
                    <div className="mt-1 flex items-center justify-between px-1">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Page {i + 1}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity">
                        Drag to reorder
                      </span>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 lg:p-0">
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div
              className="absolute inset-0 flex items-center justify-center p-1"
              style={{ containerType: "size" }}
            >
              <div
                className="max-h-full max-w-full"
                style={{
                  width: "min(100cqw, calc(100cqh * 2 / 3))",
                  height: "min(100cqh, calc(100cqw * 3 / 2))",
                }}
              >
                {isCoverSelected ? (
                  <div className="relative h-full w-full flex flex-col items-center justify-center">
                    <CoverCanvas
                      comic={comic}
                      mode="edit"
                      className="h-full w-full aspect-auto"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="absolute bottom-4 z-20 shadow-lg gap-2"
                      onClick={() => setCoverDesignerOpen(true)}
                    >
                      <Sparkles className="size-4" /> Customize Cover Page
                    </Button>
                  </div>
                ) : (
                  <PageCanvas
                    page={page}
                    mode="edit"
                    className="h-full w-full aspect-auto"
                    selectedPanelId={panel.id}
                    selectedBubbleId={bubbleId}
                    onSelectPanel={(id) => {
                      setPanelId(id);
                      setBubbleId(null);
                    }}
                    onSelectBubble={(pid, bid) => {
                      setPanelId(pid);
                      setBubbleId(bid);
                      setDialogueEditorOpen(true);
                    }}
                    onDoubleClickBubble={(pid, bid) => {
                      setPanelId(pid);
                      setBubbleId(bid);
                      setDialogueEditorOpen(true);
                    }}
                    onMoveBubble={(pid, bid, x, y) =>
                      store.updateBubble(comicId, page.id, pid, bid, { x, y })
                    }
                    onResizeBubble={(pid, bid, w) =>
                      store.updateBubble(comicId, page.id, pid, bid, { w })
                    }
                    onDropFile={(pid, file) => {
                      const target = page.panels.find((p) => p.id === pid);
                      if (target) void assignImage(target, file);
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 pt-2 lg:hidden">
            {comic.pages.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPageId(p.id);
                  setPanelId(p.panels[0]?.id ?? null);
                  setBubbleId(null);
                }}
                className={`size-9 rounded-full text-sm font-medium ${
                  p.id === page.id
                    ? "bg-foreground text-paper"
                    : "bg-secondary text-foreground"
                }`}
              >
                {i + 1}
              </button>
            ))}
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-9"
              onClick={() => {
                const id = store.addPage(comicId, "two-h");
                setPageId(id);
              }}
              aria-label="Add page"
            >
              <Plus className="size-4" />
            </Button>
          </div>

          <div className="hidden shrink-0 items-center justify-center gap-2 pt-2 lg:flex">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => store.movePage(comicId, page.id, -1)}
            >
              <ChevronUp className="size-4" />
              Up
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => store.movePage(comicId, page.id, 1)}
            >
              <ChevronDown className="size-4" />
              Down
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => store.duplicatePage(comicId, page.id)}
            >
              <Copy className="size-4" />
              Duplicate
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (comic.pages.length <= 1) {
                  toast.error("A comic needs at least one page.");
                  return;
                }
                store.removePage(comicId, page.id);
                setPageId(null);
                setPanelId(null);
              }}
            >
              <Trash2 className="size-4" />
              Delete page
            </Button>
          </div>
        </main>

        <aside className="hidden h-full w-80 shrink-0 overflow-hidden rounded-xl border border-border bg-card p-3 lg:flex lg:flex-col">
          {inspector}
        </aside>
      </div>

      <Sheet open={toolsOpen} onOpenChange={setToolsOpen}>
        <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Page tools</SheetTitle>
          </SheetHeader>
          <div className="mt-4">{inspector}</div>
        </SheetContent>
      </Sheet>

      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void assignImage(panel, file);
          e.target.value = "";
        }}
      />

      <VideoCaptureDialog
        open={videoOpen}
        onOpenChange={setVideoOpen}
        initialSource={videoSource}
        initialTab={mediaTab}
        onCapture={(ref) => {
          store.setPanelImage(comicId, page.id, panel.id, ref);
          if (!comic.cover) store.setCover(comicId, ref);
        }}
        onBatchCapture={handleBatchCapture}
        comicMediaRefs={getComicMediaRefs(comic)}
      />

      <HeadReplacementDialog
        open={headReplaceOpen}
        onOpenChange={setHeadReplaceOpen}
        comicId={comicId}
        pageId={page.id}
        panel={panel}
      />

      <CoverDesignerDialog
        open={coverDesignerOpen}
        onOpenChange={setCoverDesignerOpen}
        comic={comic}
      />

      <DialogueEditorDialog
        open={dialogueEditorOpen}
        onOpenChange={setDialogueEditorOpen}
        comicId={comicId}
        pageId={page.id}
        panelId={panel.id}
        bubble={bubble}
        onDelete={() => {
          if (bubble && page && panel) {
            store.removeBubble(comicId, page.id, panel.id, bubble.id);
            setBubbleId(null);
          }
        }}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this comic?</AlertDialogTitle>
            <AlertDialogDescription>
              Panels and dialogue stay on this device only. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                store.remove(comicId);
                navigate({ to: "/" });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Inspector({
  comicTitle,
  comicAuthor,
  onRename,
  onOpenCoverDesigner,
  onOpenDialogueModal,
  layout,
  onLayout,
  panel,
  bubble,
  onAddDialogue,
  onPickPhoto,
  onPickVideo,
  onPickLibrary,
  selectedHead,
  onSelectHead,
  onReplaceHead,
  onResetHead,
  onClearImage,
  onFilter,
  onBubblePatch,
  onDeleteBubble,
}: {
  comicTitle: string;
  comicAuthor: string;
  onRename: (title: string, author: string) => void;
  onOpenCoverDesigner: () => void;
  onOpenDialogueModal: () => void;
  layout: Parameters<typeof LayoutPicker>[0]["value"];
  onLayout: Parameters<typeof LayoutPicker>[0]["onChange"];
  panel: Panel;
  bubble: Panel["bubbles"][number] | null;
  onAddDialogue: (kind: BubbleKind) => void;
  onPickPhoto: () => void;
  onPickVideo: () => void;
  onPickLibrary: () => void;
  selectedHead: boolean;
  onSelectHead: (selected: boolean) => void;
  onReplaceHead: () => void;
  onResetHead: () => void;
  onClearImage: () => void;
  onFilter: (filter: Panel["filter"]) => void;
  onBubblePatch: (patch: {
    text?: string;
    kind?: BubbleKind;
    tail?: TailDir;
  }) => void;
  onDeleteBubble: () => void;
}) {
  const hasFaceReplacement = Boolean(
    (panel.faceReplacements && panel.faceReplacements.length > 0) ||
      (panel.originalImage && panel.originalImage !== panel.image),
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto max-lg:h-auto max-lg:overflow-visible pr-1">
      <section className="grid shrink-0 grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="comic-title">Title</Label>
          <Input
            id="comic-title"
            className="h-8 text-xs font-semibold"
            defaultValue={comicTitle}
            onBlur={(e) => onRename(e.target.value, comicAuthor)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="comic-author">Byline</Label>
          <Input
            id="comic-author"
            className="h-8 text-xs"
            defaultValue={comicAuthor}
            onBlur={(e) => onRename(comicTitle, e.target.value)}
          />
        </div>
      </section>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onOpenCoverDesigner}
        className="w-full text-xs font-bold gap-1.5 border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
      >
        <Sparkles className="size-3.5" />
        Open Cover Page Designer
      </Button>

      <Separator className="shrink-0" />

      <section className="shrink-0 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Layout
        </p>
        <LayoutPicker value={layout} onChange={onLayout} />
      </section>

      <Separator className="shrink-0" />

      <section className="shrink-0 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Selected panel
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          <Button type="button" variant="outline" size="sm" className="px-1.5 text-xs" onClick={onPickPhoto}>
            <ImagePlus className="size-3.5" />
            Photo
          </Button>
          <Button type="button" variant="outline" size="sm" className="px-1.5 text-xs" onClick={onPickLibrary}>
            <Images className="size-3.5" />
            Library
          </Button>
          <Button type="button" variant="outline" size="sm" className="px-1.5 text-xs" onClick={onPickVideo}>
            <Video className="size-3.5" />
            Video
          </Button>
        </div>
        {panel.image ? (
          <div className="flex flex-col gap-1.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30"
              onClick={onReplaceHead}
            >
              <ScanFace className="size-3.5 text-primary" />
              {hasFaceReplacement ? "Edit head" : "Replace head"}
            </Button>

            {hasFaceReplacement && (
              <div
                onClick={() => onSelectHead(!selectedHead)}
                className={`group relative flex items-center justify-between p-2 rounded-md border cursor-pointer transition-all ${
                  selectedHead
                    ? "border-primary bg-primary/15 shadow-sm ring-1 ring-primary/40"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <ScanFace className="size-3.5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-foreground">Replacement head</span>
                    <span className="text-[10px] text-muted-foreground">Selectable • Press Backspace to remove</span>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[11px] px-2 text-primary hover:bg-primary/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReplaceHead();
                  }}
                >
                  Edit
                </Button>
              </div>
            )}

            <Button type="button" variant="ghost" className="w-full text-xs h-7 text-muted-foreground" onClick={onClearImage}>
              Remove image
            </Button>
          </div>
        ) : null}

        <p className="text-[11px] font-semibold text-muted-foreground uppercase pt-1">
          Comic Filters
        </p>
        <div className="grid grid-cols-2 gap-1 max-h-36 overflow-y-auto pr-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onFilter(f.id)}
              className={`h-7 px-1.5 rounded-md border text-[11px] font-medium truncate ${
                panel.filter === f.id
                  ? "border-primary bg-primary/15 text-primary font-bold shadow-xs"
                  : "border-border bg-card hover:border-foreground/30"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      <Separator className="shrink-0" />

      <section className="shrink-0 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Dialogue & Headings
        </p>
        <div className={bubble ? "grid grid-cols-1 gap-2" : "space-y-2"}>
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                ["speech", "Speech", MessageCircle],
                ["thought", "Thought", Cloud],
                ["shout", "Shout", Megaphone],
                ["caption", "Caption", Captions],
                ["sfx", "SFX (KAPOW!)", Zap],
                ["title-banner", "Scene Banner", Bookmark],
                ["burst-label", "Starburst", Award],
              ] as const
            ).map(([kind, label, Icon]) => {
              const selected = bubble?.kind === kind;
              return (
                <Button
                  key={kind}
                  type="button"
                  variant={selected ? "default" : "secondary"}
                  size="sm"
                  className="h-8 justify-start px-2 text-[11px]"
                  onClick={() => onAddDialogue(kind)}
                >
                  <Icon className="size-3.5 shrink-0" />
                  <span className="truncate">{label}</span>
                </Button>
              );
            })}
          </div>
          {bubble ? (
            <div className="space-y-2 rounded-lg border border-primary/25 bg-secondary/40 p-2.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="bubble-text" className="text-xs font-semibold">
                  Balloon Content
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] px-2 gap-1 text-primary border-primary/30 hover:bg-primary/10"
                  onClick={onOpenDialogueModal}
                >
                  <MessageCircle className="size-3" />
                  Open Modal
                </Button>
              </div>
              <Textarea
                id="bubble-text"
                value={bubble.text}
                onChange={(e) => onBubblePatch({ text: e.target.value })}
                className="min-h-16 resize-none text-xs"
              />
              <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-1.5">
                <label className="text-xs text-muted-foreground">
                  Style
                  <select
                    className="mt-1 h-8 w-full rounded-md border border-input bg-card px-2 text-xs text-foreground"
                    value={bubble.kind}
                    onChange={(e) => onBubblePatch({ kind: e.target.value as BubbleKind })}
                  >
                    <option value="speech">Speech</option>
                    <option value="thought">Thought</option>
                    <option value="shout">Shout</option>
                    <option value="caption">Caption</option>
                    <option value="sfx">SFX Sound Effect</option>
                    <option value="title-banner">Scene Banner</option>
                    <option value="burst-label">Starburst Badge</option>
                  </select>
                </label>
                <label className="text-xs text-muted-foreground">
                  Tail
                  <select
                    className="mt-1 h-8 w-full rounded-md border border-input bg-card px-2 text-xs text-foreground"
                    value={bubble.tail}
                    onChange={(e) => onBubblePatch({ tail: e.target.value as TailDir })}
                  >
                    <option value="bl">Bottom left</option>
                    <option value="br">Bottom right</option>
                    <option value="tl">Top left</option>
                    <option value="tr">Top right</option>
                    <option value="none">None</option>
                  </select>
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={onDeleteBubble}
                  aria-label="Remove balloon"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Pick a style to add dialogue, SFX heading, or action banner.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
