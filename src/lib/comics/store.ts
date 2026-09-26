import { create } from "zustand";
import { createDemoComic } from "./demo";
import {
  changePageLayoutPreservingImages,
  createBubble,
  createComic,
  createPage,
  defaultCoverConfig,
  fitPanelsToLayout,
} from "./factory";
import { deleteMediaRef } from "./media";
import type {
  BubbleKind,
  Comic,
  CoverConfig,
  PageLayoutId,
  PanelFilter,
  SpeechBubble,
} from "./types";

const KEY = "inkframe.comics.v1";
const BACKUP_KEY = "inkframe.comics.v1.backup";
const DELETED_KEY = "inkframe.deleted_ids";

function readDeletedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function recordDeletedId(id: string) {
  try {
    const set = readDeletedIds();
    set.add(id);
    localStorage.setItem(DELETED_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

function clearDeletedId(id: string) {
  try {
    const set = readDeletedIds();
    set.delete(id);
    localStorage.setItem(DELETED_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

function readComics(): Comic[] {
  try {
    const deletedIds = readDeletedIds();
    const raw = localStorage.getItem(KEY);
    const backupRaw = localStorage.getItem(BACKUP_KEY);
    let primary: Comic[] = [];
    let backup: Comic[] = [];

    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) primary = parsed;
    }
    if (backupRaw !== null) {
      const parsedBackup = JSON.parse(backupRaw);
      if (Array.isArray(parsedBackup)) backup = parsedBackup;
    }

    const map = new Map<string, Comic>();
    for (const c of backup) {
      if (!deletedIds.has(c.id)) map.set(c.id, c);
    }
    for (const c of primary) {
      if (!deletedIds.has(c.id)) map.set(c.id, c);
    }

    if (map.size === 0) return [createDemoComic()];
    return Array.from(map.values());
  } catch {
    return [createDemoComic()];
  }
}

function writeComics(comics: Comic[]) {
  try {
    const currentRaw = localStorage.getItem(KEY);
    if (currentRaw) {
      localStorage.setItem(BACKUP_KEY, currentRaw);
    }
    localStorage.setItem(KEY, JSON.stringify(comics));
  } catch {
    // ignore
  }
}

function touch(comic: Comic): Comic {
  return { ...comic, updatedAt: Date.now() };
}

function mapComic(comics: Comic[], id: string, fn: (c: Comic) => Comic): Comic[] {
  return comics.map((c) => (c.id === id ? touch(fn(c)) : c));
}

interface ComicState {
  comics: Comic[];
  past: Comic[][];
  future: Comic[][];
  canUndo: boolean;
  canRedo: boolean;
  lastSavedAt: number | null;
  hydrated: boolean;
  hydrate: () => void;
  syncMcpComics: () => Promise<void>;
  importComics: (rawJson: string) => boolean;
  undo: () => void;
  redo: () => void;
  saveNow: (comicId?: string) => void;
  create: (title: string, author: string) => string;
  restoreDemo: () => string;
  rename: (id: string, title: string, author: string) => void;
  remove: (id: string) => void;
  addPage: (comicId: string, layout?: PageLayoutId) => string;
  removePage: (comicId: string, pageId: string) => void;
  duplicatePage: (comicId: string, pageId: string) => void;
  movePage: (comicId: string, pageId: string, dir: -1 | 1) => void;
  reversePages: (comicId: string) => void;
  reorderPageIndices: (comicId: string, fromIndex: number, toIndex: number) => void;
  setLayout: (comicId: string, pageId: string, layout: PageLayoutId) => void;
  setPanelImage: (comicId: string, pageId: string, panelId: string, image: string | null) => void;
  setPanelFilter: (comicId: string, pageId: string, panelId: string, filter: PanelFilter) => void;
  addBubble: (comicId: string, pageId: string, panelId: string, kind: BubbleKind) => string;
  updateBubble: (
    comicId: string,
    pageId: string,
    panelId: string,
    bubbleId: string,
    patch: Partial<SpeechBubble>,
  ) => void;
  removeBubble: (comicId: string, pageId: string, panelId: string, bubbleId: string) => void;
  setCover: (comicId: string, cover: string | null) => void;
  setCoverConfig: (comicId: string, patch: Partial<CoverConfig>) => void;
}

const MAX_HISTORY = 30;

function pushState(set: any, get: any, newComics: Comic[]) {
  const past = get().past || [];
  const current = get().comics;
  writeComics(newComics);
  set({
    comics: newComics,
    past: [...past.slice(-MAX_HISTORY + 1), current],
    future: [],
    canUndo: true,
    canRedo: false,
    lastSavedAt: Date.now(),
  });
}

export const useComicStore = create<ComicState>((set, get) => ({
  comics: [],
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,
  lastSavedAt: null,
  hydrated: false,

  undo: () => {
    const past = get().past;
    if (!past || past.length === 0) return;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    const current = get().comics;

    writeComics(previous);
    set({
      comics: previous,
      past: newPast,
      future: [current, ...get().future],
      canUndo: newPast.length > 0,
      canRedo: true,
      lastSavedAt: Date.now(),
    });
  },

  redo: () => {
    const future = get().future;
    if (!future || future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    const current = get().comics;

    writeComics(next);
    set({
      comics: next,
      past: [...get().past, current],
      future: newFuture,
      canUndo: true,
      canRedo: newFuture.length > 0,
      lastSavedAt: Date.now(),
    });
  },

  saveNow: (comicId?: string) => {
    const comics = get().comics;
    const updatedComics = comicId
      ? comics.map((c) => (c.id === comicId ? touch(c) : c))
      : comics;
    writeComics(updatedComics);
    set({ comics: updatedComics, lastSavedAt: Date.now() });
    void get().syncMcpComics();
  },

  syncMcpComics: async () => {
    if (typeof window === "undefined") return;
    try {
      const res = await fetch("/mcp_comics.json", { cache: "no-store" });
      if (!res.ok) return;
      const mcpComics = (await res.json()) as Comic[];
      if (!Array.isArray(mcpComics) || mcpComics.length === 0) return;

      const deletedIds = readDeletedIds();
      const localComics = readComics();
      const current = get().comics;
      const map = new Map<string, Comic>();

      for (const c of localComics) {
        if (!deletedIds.has(c.id)) map.set(c.id, c);
      }
      for (const c of current) {
        if (!deletedIds.has(c.id)) map.set(c.id, c);
      }

      let changed = false;
      for (const mcpC of mcpComics) {
        if (deletedIds.has(mcpC.id)) continue;

        const existing = map.get(mcpC.id);
        const mcpTime = mcpC.updatedAt ?? 0;
        const existingTime = existing?.updatedAt ?? 0;

        if (!existing || mcpTime > existingTime) {
          if (!existing || JSON.stringify(existing) !== JSON.stringify(mcpC)) {
            map.set(mcpC.id, mcpC);
            changed = true;
          }
        }
      }

      if (changed || map.size > current.length) {
        const updated = Array.from(map.values());
        writeComics(updated);
        set({ comics: updated });
      }
    } catch {
      // ignore network errors
    }
  },

  hydrate: () => {
    if (get().hydrated || typeof window === "undefined") return;
    set({ comics: readComics(), hydrated: true });
    void get().syncMcpComics();
    window.addEventListener("focus", () => void get().syncMcpComics());
    setInterval(() => void get().syncMcpComics(), 2000);
  },

  importComics: (rawJson: string) => {
    try {
      const parsed = JSON.parse(rawJson);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      const valid = items.filter(
        (c) => c && typeof c === "object" && typeof c.id === "string" && typeof c.title === "string",
      );
      if (valid.length === 0) return false;

      for (const c of valid) clearDeletedId(c.id);

      const map = new Map(get().comics.map((c) => [c.id, c]));
      for (const c of valid) map.set(c.id, c as Comic);
      const updated = Array.from(map.values());
      writeComics(updated);
      set({ comics: updated });
      return true;
    } catch {
      return false;
    }
  },

  create: (title, author) => {
    const comic = createComic(title, author);
    clearDeletedId(comic.id);
    const comics = [comic, ...get().comics];
    writeComics(comics);
    set({ comics });
    return comic.id;
  },

  restoreDemo: () => {
    const demo = createDemoComic();
    clearDeletedId(demo.id);
    const comics = [demo, ...get().comics.filter((c) => c.id !== demo.id)];
    writeComics(comics);
    set({ comics });
    return demo.id;
  },

  rename: (id, title, author) => {
    const comics = mapComic(get().comics, id, (c) => ({
      ...c,
      title: title.trim() || c.title,
      author: author.trim() || c.author,
    }));
    pushState(set, get, comics);
  },

  remove: (id) => {
    recordDeletedId(id);
    const target = get().comics.find((c) => c.id === id);
    if (target) {
      void deleteMediaRef(target.cover);
      for (const page of target.pages) {
        for (const panel of page.panels) void deleteMediaRef(panel.image);
      }
    }
    const comics = get().comics.filter((c) => c.id !== id);
    const past = (get().past || []).map((list) => list.filter((c) => c.id !== id));
    const future = (get().future || []).map((list) => list.filter((c) => c.id !== id));
    writeComics(comics);
    set({ comics, past, future });
  },

  addPage: (comicId, layout = "splash") => {
    const page = createPage(layout);
    const comics = mapComic(get().comics, comicId, (c) => ({
      ...c,
      pages: [...c.pages, page],
    }));
    pushState(set, get, comics);
    return page.id;
  },

  removePage: (comicId, pageId) => {
    const targetComic = get().comics.find((c) => c.id === comicId);
    if (targetComic) {
      const pageToDelete = targetComic.pages.find((p) => p.id === pageId);
      if (pageToDelete) {
        for (const panel of pageToDelete.panels) {
          if (panel.image) void deleteMediaRef(panel.image);
        }
      }
    }
    const comics = mapComic(get().comics, comicId, (c) => {
      if (c.pages.length <= 1) return c;
      return { ...c, pages: c.pages.filter((p) => p.id !== pageId) };
    });
    pushState(set, get, comics);
  },

  duplicatePage: (comicId, pageId) => {
    const comics = mapComic(get().comics, comicId, (c) => {
      const idx = c.pages.findIndex((p) => p.id === pageId);
      if (idx < 0) return c;
      const src = c.pages[idx];
      const copy: typeof src = {
        ...src,
        id: crypto.randomUUID(),
        panels: src.panels.map((panel) => ({
          ...panel,
          id: crypto.randomUUID(),
          bubbles: panel.bubbles.map((b) => ({ ...b, id: crypto.randomUUID() })),
        })),
      };
      const pages = [...c.pages];
      pages.splice(idx + 1, 0, copy);
      return { ...c, pages };
    });
    pushState(set, get, comics);
  },

  movePage: (comicId, pageId, dir) => {
    const comics = mapComic(get().comics, comicId, (c) => {
      const idx = c.pages.findIndex((p) => p.id === pageId);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= c.pages.length) return c;
      const pages = [...c.pages];
      const [item] = pages.splice(idx, 1);
      pages.splice(next, 0, item);
      return { ...c, pages };
    });
    pushState(set, get, comics);
  },

  reversePages: (comicId) => {
    const comics = mapComic(get().comics, comicId, (c) => ({
      ...c,
      pages: [...c.pages].reverse(),
    }));
    pushState(set, get, comics);
  },

  reorderPageIndices: (comicId, fromIndex, toIndex) => {
    const comics = mapComic(get().comics, comicId, (c) => {
      if (
        fromIndex < 0 ||
        fromIndex >= c.pages.length ||
        toIndex < 0 ||
        toIndex >= c.pages.length ||
        fromIndex === toIndex
      ) {
        return c;
      }
      const pages = [...c.pages];
      const [item] = pages.splice(fromIndex, 1);
      pages.splice(toIndex, 0, item);
      return { ...c, pages };
    });
    pushState(set, get, comics);
  },

  setLayout: (comicId, pageId, layout) => {
    const targetComic = get().comics.find((c) => c.id === comicId);
    if (!targetComic) return;
    const updatedComic = changePageLayoutPreservingImages(targetComic, pageId, layout);
    const comics = get().comics.map((c) =>
      c.id === comicId ? { ...updatedComic, updatedAt: Date.now() } : c,
    );
    pushState(set, get, comics);
  },

  setPanelImage: (comicId, pageId, panelId, image) => {
    const comics = mapComic(get().comics, comicId, (c) => ({
      ...c,
      pages: c.pages.map((p) => {
        if (p.id !== pageId) return p;
        return {
          ...p,
          panels: p.panels.map((panel) => {
            if (panel.id !== panelId) return panel;
            return {
              ...panel,
              image,
            };
          }),
        };
      }),
    }));
    pushState(set, get, comics);
  },

  setPanelFilter: (comicId, pageId, panelId, filter) => {
    const comics = mapComic(get().comics, comicId, (c) => ({
      ...c,
      pages: c.pages.map((p) =>
        p.id === pageId
          ? {
              ...p,
              panels: p.panels.map((panel) =>
                panel.id === panelId ? { ...panel, filter } : panel,
              ),
            }
          : p,
      ),
    }));
    pushState(set, get, comics);
  },

  addBubble: (comicId, pageId, panelId, kind) => {
    const bubble = createBubble(kind);
    const comics = mapComic(get().comics, comicId, (c) => ({
      ...c,
      pages: c.pages.map((p) =>
        p.id === pageId
          ? {
              ...p,
              panels: p.panels.map((panel) =>
                panel.id === panelId
                  ? { ...panel, bubbles: [...panel.bubbles, bubble] }
                  : panel,
              ),
            }
          : p,
      ),
    }));
    pushState(set, get, comics);
    return bubble.id;
  },

  updateBubble: (comicId, pageId, panelId, bubbleId, patch) => {
    const comics = mapComic(get().comics, comicId, (c) => ({
      ...c,
      pages: c.pages.map((p) =>
        p.id === pageId
          ? {
              ...p,
              panels: p.panels.map((panel) =>
                panel.id === panelId
                  ? {
                      ...panel,
                      bubbles: panel.bubbles.map((b) =>
                        b.id === bubbleId ? { ...b, ...patch } : b,
                      ),
                    }
                  : panel,
              ),
            }
          : p,
      ),
    }));
    pushState(set, get, comics);
  },

  removeBubble: (comicId, pageId, panelId, bubbleId) => {
    const comics = mapComic(get().comics, comicId, (c) => ({
      ...c,
      pages: c.pages.map((p) =>
        p.id === pageId
          ? {
              ...p,
              panels: p.panels.map((panel) =>
                panel.id === panelId
                  ? {
                      ...panel,
                      bubbles: panel.bubbles.filter((b) => b.id !== bubbleId),
                    }
                  : panel,
              ),
            }
          : p,
      ),
    }));
    pushState(set, get, comics);
  },

  setCover: (comicId, cover) => {
    const comics = mapComic(get().comics, comicId, (c) => {
      if (c.cover && c.cover !== cover) void deleteMediaRef(c.cover);
      return { ...c, cover };
    });
    pushState(set, get, comics);
  },

  setCoverConfig: (comicId, patch) => {
    const comics = mapComic(get().comics, comicId, (c) => ({
      ...c,
      coverConfig: {
        ...(c.coverConfig ?? defaultCoverConfig()),
        ...patch,
      },
    }));
    pushState(set, get, comics);
  },
}));

export function getComicMediaRefs(comic: Comic): string[] {
  const set = new Set<string>();
  if (comic.cover) set.add(comic.cover);
  for (const page of comic.pages) {
    for (const panel of page.panels) {
      if (panel.image) set.add(panel.image);
    }
  }
  return Array.from(set);
}

