import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { BookOpen, Download, FileDown, Loader2, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { coverRef } from "@/lib/comics/factory";
import { useMediaUrl } from "@/lib/comics/media";
import { exportComicToPdf } from "@/lib/comics/pdf-export";
import { useComicStore } from "@/lib/comics/store";
import type { Comic } from "@/lib/comics/types";
import { CoverCanvas } from "./cover-canvas";

export function LibraryView() {
  const navigate = useNavigate();
  const comics = useComicStore((s) => s.comics);
  const hydrated = useComicStore((s) => s.hydrated);
  const create = useComicStore((s) => s.create);
  const restoreDemo = useComicStore((s) => s.restoreDemo);
  const remove = useComicStore((s) => s.remove);
  const importComics = useComicStore((s) => s.importComics);

  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const id = create(title || "Untitled", author || "Anonymous");
    setOpen(false);
    setTitle("");
    setAuthor("");
    void navigate({ to: "/studio/$comicId", params: { comicId: id } });
  }

  function handleImport(e: React.FormEvent) {
    e.preventDefault();
    const ok = importComics(importText);
    if (ok) {
      setImportOpen(false);
      setImportText("");
      setImportError(false);
    } else {
      setImportError(true);
    }
  }

  function handleExport() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(comics, null, 2));
    const dlAnchorElem = document.createElement("a");
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "inkframe-comics-backup.json");
    dlAnchorElem.click();
  }

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-8 pt-8 sm:px-6 sm:pt-12">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">
              Studio
            </p>
            <h1 className="mt-2 font-display text-5xl leading-none text-foreground sm:text-7xl">
              Inkframe
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
              Turn photos and video stills into a comic. Add dialogue, pick a
              layout, then read it with a page-turn and guided panel zoom.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => setOpen(true)}>
              <Plus />
              New comic
            </Button>
            <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" />
              Import
            </Button>
            <Button type="button" variant="outline" onClick={handleExport}>
              <Download className="size-4" />
              Export
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const id = restoreDemo();
                void navigate({ to: "/read/$comicId", params: { comicId: id } });
              }}
            >
              Open demo
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
        {!hydrated ? (
          <p className="text-sm text-muted-foreground">Loading the shelf…</p>
        ) : comics.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
            <p className="font-semibold">No comics yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Start a blank book, or restore Last One Out to see the reader.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <Button type="button" onClick={() => setOpen(true)}>
                New comic
              </Button>
              <Button type="button" variant="outline" onClick={() => restoreDemo()}>
                Restore demo
              </Button>
            </div>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {comics.map((comic, i) => (
              <li
                key={comic.id}
                className={`anim-rise stagger-${Math.min(i + 1, 5)}`}
              >
                <ComicCard
                  comic={comic}
                  onDelete={() => setPendingDelete(comic.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>New comic</DialogTitle>
              <DialogDescription>
                Give it a title. You can add pages, photos, and dialogue next.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="new-title">Title</Label>
              <Input
                id="new-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Last One Out"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-author">Byline</Label>
              <Input
                id="new-author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <DialogFooter>
              <Button type="submit">Open studio</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this comic?</AlertDialogTitle>
            <AlertDialogDescription>
              Panels stored on this device will be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) remove(pendingDelete);
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleImport} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Import Comic Backup JSON</DialogTitle>
              <DialogDescription>
                Paste exported comic JSON or backup JSON data below to restore your comics.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="import-json">Comic JSON Data</Label>
              <textarea
                id="import-json"
                rows={6}
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  setImportError(false);
                }}
                placeholder='Paste JSON array or single comic object here...'
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {importError && (
                <p className="text-xs text-destructive">Invalid comic JSON format. Please check the text.</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Import</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ComicCard({ comic, onDelete }: { comic: Comic; onDelete: () => void }) {
  const pages = comic.pages.length;
  const [isExporting, setIsExporting] = useState(false);

  async function handleExportPdf() {
    setIsExporting(true);
    const toastId = toast.loading("Preparing PDF export...");
    try {
      await exportComicToPdf(comic, (status) => {
        toast.loading(status, { id: toastId });
      });
      toast.success("PDF exported successfully!", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Failed to export PDF.", { id: toastId });
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <article className="group overflow-hidden rounded-xl bg-card paper-shadow transition-transform duration-200 ease-out hover:-translate-y-0.5 border border-border">
      <Link
        to="/read/$comicId"
        params={{ comicId: comic.id }}
        className="block"
      >
        <div className="relative aspect-[2/3] overflow-hidden bg-secondary">
          <CoverCanvas comic={comic} mode="thumb" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 via-ink/40 to-transparent p-3 pt-8">
            <h2 className="truncate font-display text-lg text-paper">{comic.title}</h2>
            <p className="truncate text-xs text-paper/80 font-medium">
              {comic.author} · {pages} {pages === 1 ? "page" : "pages"}
            </p>
          </div>
        </div>
      </Link>
      <div className="flex items-center gap-1 p-2">
        <Button asChild variant="ghost" size="sm" className="flex-1 px-2 text-xs">
          <Link to="/read/$comicId" params={{ comicId: comic.id }}>
            <BookOpen className="size-3.5" />
            Read
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className="flex-1 px-2 text-xs">
          <Link to="/studio/$comicId" params={{ comicId: comic.id }}>
            <Pencil className="size-3.5" />
            Edit
          </Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isExporting}
          className="size-8 text-muted-foreground"
          onClick={handleExportPdf}
          aria-label={`Export PDF for ${comic.title}`}
          title="Export PDF"
        >
          {isExporting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileDown className="size-4" />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground"
          onClick={onDelete}
          aria-label={`Delete ${comic.title}`}
          title="Delete"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </article>
  );
}
