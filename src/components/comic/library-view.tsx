import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
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
import { useComicStore } from "@/lib/comics/store";
import type { Comic } from "@/lib/comics/types";

export function LibraryView() {
  const navigate = useNavigate();
  const comics = useComicStore((s) => s.comics);
  const hydrated = useComicStore((s) => s.hydrated);
  const create = useComicStore((s) => s.create);
  const restoreDemo = useComicStore((s) => s.restoreDemo);
  const remove = useComicStore((s) => s.remove);

  const [open, setOpen] = useState(false);
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
              Start a blank book, or restore Night Bus 42 to see the reader.
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
                placeholder="Night Bus 42"
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
    </div>
  );
}

function ComicCard({ comic, onDelete }: { comic: Comic; onDelete: () => void }) {
  const src = useMediaUrl(coverRef(comic));
  const pages = comic.pages.length;

  return (
    <article className="group overflow-hidden rounded-xl bg-card paper-shadow transition-transform duration-200 ease-out hover:-translate-y-0.5">
      <Link
        to="/read/$comicId"
        params={{ comicId: comic.id }}
        className="block"
      >
        <div className="relative aspect-[2/3] overflow-hidden bg-secondary">
          {src ? (
            <img
              src={src}
              alt=""
              className="absolute inset-0 size-full object-cover outline outline-1 -outline-offset-1 outline-foreground/10 transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-end p-4">
              <span className="font-display text-3xl leading-none text-foreground/80">
                {comic.title}
              </span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 to-transparent p-3 pt-10">
            <h2 className="truncate font-semibold text-paper">{comic.title}</h2>
            <p className="truncate text-xs text-paper/70">
              {comic.author} · {pages} {pages === 1 ? "page" : "pages"}
            </p>
          </div>
        </div>
      </Link>
      <div className="flex items-center gap-1 p-2">
        <Button asChild variant="ghost" size="sm" className="flex-1">
          <Link to="/read/$comicId" params={{ comicId: comic.id }}>
            <BookOpen />
            Read
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className="flex-1">
          <Link to="/studio/$comicId" params={{ comicId: comic.id }}>
            <Pencil />
            Edit
          </Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 text-muted-foreground"
          onClick={onDelete}
          aria-label={`Delete ${comic.title}`}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </article>
  );
}
