import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Copy,
  ImagePlus,
  MessageCircle,
  Cloud,
  Megaphone,
  Captions,
  Plus,
  Trash2,
  Video,
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
import { useComicStore } from "@/lib/comics/store";
import type { BubbleKind, Panel, TailDir } from "@/lib/comics/types";
import { LayoutPicker } from "./layout-picker";
import { PageCanvas } from "./page-canvas";
import { VideoCaptureDialog } from "./video-capture-dialog";

export function StudioEditor({ comicId }: { comicId: string }) {
  const navigate = useNavigate();
  const comic = useComicStore((s) => s.comics.find((c) => c.id === comicId));
  const hydrated = useComicStore((s) => s.hydrated);
  const store = useComicStore();

  const [pageId, setPageId] = useState<string | null>(null);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [bubbleId, setBubbleId] = useState<string | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoSource, setVideoSource] = useState<File | string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
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
      layout={page.layout}
      onLayout={(layout) => store.setLayout(comicId, page.id, layout)}
      panel={panel}
      bubble={bubble}
      onAddDialogue={addDialogue}
      onPickPhoto={() => photoRef.current?.click()}
      onPickVideo={() => {
        setVideoSource(null);
        setVideoOpen(true);
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

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/90 px-3 py-2 backdrop-blur-sm sm:px-4">
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

      <div className="mx-auto flex w-full max-w-[1440px] flex-1 gap-0 lg:gap-4 lg:p-4">
        <aside className="hidden w-52 shrink-0 flex-col gap-3 lg:flex">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pages
            </p>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8"
              onClick={() => {
                const id = store.addPage(comicId, "two-h");
                setPageId(id);
                setPanelId(null);
                setBubbleId(null);
              }}
              aria-label="Add page"
            >
              <Plus className="size-4" />
            </Button>
          </div>
          <div className="flex flex-col gap-2 overflow-y-auto pb-6">
            {comic.pages.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPageId(p.id);
                  setPanelId(p.panels[0]?.id ?? null);
                  setBubbleId(null);
                }}
                className={`overflow-hidden rounded-lg border p-1 text-left transition-[border-color] duration-150 ${
                  p.id === page.id
                    ? "border-primary"
                    : "border-border hover:border-foreground/30"
                }`}
              >
                <PageCanvas page={p} mode="thumb" />
                <span className="mt-1 block px-1 text-[11px] font-medium text-muted-foreground">
                  Page {i + 1}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-3 p-3 lg:p-0">
          <div className="mx-auto w-full max-w-[560px]">
            <PageCanvas
              page={page}
              mode="edit"
              selectedPanelId={panel.id}
              selectedBubbleId={bubbleId}
              onSelectPanel={(id) => {
                setPanelId(id);
                setBubbleId(null);
              }}
              onSelectBubble={(pid, bid) => {
                setPanelId(pid);
                setBubbleId(bid);
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
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 lg:hidden">
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

          <div className="hidden items-center justify-center gap-2 lg:flex">
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

        <aside className="hidden w-80 shrink-0 overflow-y-auto rounded-xl border border-border bg-card p-4 lg:block">
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
        onCapture={(ref) => {
          store.setPanelImage(comicId, page.id, panel.id, ref);
          if (!comic.cover) store.setCover(comicId, ref);
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
  layout,
  onLayout,
  panel,
  bubble,
  onAddDialogue,
  onPickPhoto,
  onPickVideo,
  onClearImage,
  onFilter,
  onBubblePatch,
  onDeleteBubble,
}: {
  comicTitle: string;
  comicAuthor: string;
  onRename: (title: string, author: string) => void;
  layout: Parameters<typeof LayoutPicker>[0]["value"];
  onLayout: Parameters<typeof LayoutPicker>[0]["onChange"];
  panel: Panel;
  bubble: Panel["bubbles"][number] | null;
  onAddDialogue: (kind: BubbleKind) => void;
  onPickPhoto: () => void;
  onPickVideo: () => void;
  onClearImage: () => void;
  onFilter: (filter: Panel["filter"]) => void;
  onBubblePatch: (patch: {
    text?: string;
    kind?: BubbleKind;
    tail?: TailDir;
  }) => void;
  onDeleteBubble: () => void;
}) {
  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <Label htmlFor="comic-title">Title</Label>
        <Input
          id="comic-title"
          defaultValue={comicTitle}
          onBlur={(e) => onRename(e.target.value, comicAuthor)}
        />
        <Label htmlFor="comic-author">Byline</Label>
        <Input
          id="comic-author"
          defaultValue={comicAuthor}
          onBlur={(e) => onRename(comicTitle, e.target.value)}
        />
      </section>

      <Separator />

      <section className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Layout
        </p>
        <LayoutPicker value={layout} onChange={onLayout} />
      </section>

      <Separator />

      <section className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Selected panel
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={onPickPhoto}>
            <ImagePlus />
            Photo
          </Button>
          <Button type="button" variant="outline" onClick={onPickVideo}>
            <Video />
            Video frame
          </Button>
        </div>
        {panel.image ? (
          <Button type="button" variant="ghost" className="w-full" onClick={onClearImage}>
            Remove image
          </Button>
        ) : null}
        <div className="grid grid-cols-2 gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onFilter(f.id)}
              className={`h-9 rounded-md border text-xs font-medium ${
                panel.filter === f.id
                  ? "border-primary bg-secondary"
                  : "border-border bg-card"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      <Separator />

      <section className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Dialogue
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["speech", "Speech", MessageCircle],
              ["thought", "Thought", Cloud],
              ["shout", "Shout", Megaphone],
              ["caption", "Caption", Captions],
            ] as const
          ).map(([kind, label, Icon]) => (
            <Button
              key={kind}
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onAddDialogue(kind)}
            >
              <Icon />
              {label}
            </Button>
          ))}
        </div>
      </section>

      {bubble ? (
        <section className="space-y-2 rounded-lg border border-border bg-secondary/40 p-3">
          <Label htmlFor="bubble-text">Selected balloon</Label>
          <Textarea
            id="bubble-text"
            value={bubble.text}
            onChange={(e) => onBubblePatch({ text: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted-foreground">
              Style
              <select
                className="mt-1 h-10 w-full rounded-md border border-input bg-card px-2 text-sm text-foreground"
                value={bubble.kind}
                onChange={(e) => onBubblePatch({ kind: e.target.value as BubbleKind })}
              >
                <option value="speech">Speech</option>
                <option value="thought">Thought</option>
                <option value="shout">Shout</option>
                <option value="caption">Caption</option>
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Tail
              <select
                className="mt-1 h-10 w-full rounded-md border border-input bg-card px-2 text-sm text-foreground"
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
          </div>
          <Button type="button" variant="ghost" className="w-full" onClick={onDeleteBubble}>
            <Trash2 />
            Remove balloon
          </Button>
        </section>
      ) : (
        <p className="text-xs text-muted-foreground">
          Select a balloon on the page to edit its line, or add a new one.
        </p>
      )}
    </div>
  );
}
