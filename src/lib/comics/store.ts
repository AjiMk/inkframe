import { create } from "zustand";
import { createDemoComic } from "./demo.ts";
import {
  changePageLayoutPreservingImages,
  createBubble,
  createComic,
  createPage,
  defaultCoverConfig,
} from "./factory.ts";
import { deleteMediaRef, pruneMedia, getMedia, uploadAssetToDev } from "./media.ts";
import { mergeComics } from "./sync.ts";
import { deleteCharacterFromComic, deleteBackgroundFromComic } from "./continuity.ts";
import type {
  AssetReferenceContext,
  BackgroundReference,
  BubbleKind,
  CharacterReference,
  Comic,
  CoverConfig,
  PageLayoutId,
  PanelFilter,
  PanelScene,
  SpeechBubble,
} from "./types.ts";

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
  setPanelScene: (
    comicId: string,
    pageId: string,
    panelId: string,
    patch: Partial<PanelScene> | null,
  ) => void;
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
  updateAssetContext: (comicId: string, patch: Partial<AssetReferenceContext>) => void;
  upsertCharacter: (comicId: string, char: CharacterReference) => void;
  deleteCharacter: (comicId: string, charId: string) => void;
  upsertBackground: (comicId: string, bg: BackgroundReference) => void;
  deleteBackground: (comicId: string, bgId: string) => void;
}

const MAX_HISTORY = 30;

let devSyncTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleDevSync(comics: Comic[]) {
  if (typeof window === "undefined") return;
  if (devSyncTimer) clearTimeout(devSyncTimer);
  devSyncTimer = setTimeout(() => {
    void pushComicsToDevSync(comics);
  }, 800);
}

export async function pushComicsToDevSync(comics: Comic[]): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const deletedIds = Array.from(readDeletedIds());
    await fetch("/__inkframe/comics", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comics, deletedIds }),
    });
  } catch {
    // Dev sync endpoint unreachable in production / offline, ignore
  }
}

async function migrateReferencesToAssets(comics: Comic[]): Promise<Comic[] | null> {
  let changed = false;
  const updatedComics: Comic[] = [];

  for (const c of comics) {
    let comicChanged = false;
    let newAssetContext = c.assetContext;

    if (newAssetContext?.characters) {
      let charsChanged = false;
      const updatedChars = { ...newAssetContext.characters };
      for (const [id, char] of Object.entries(updatedChars)) {
        if (char.imageRef?.startsWith("idb:")) {
          const mediaId = char.imageRef.slice(4);
          const blob = await getMedia(mediaId);
          if (blob) {
            const ok = await uploadAssetToDev(mediaId, blob);
            if (ok) {
              updatedChars[id] = { ...char, imageRef: `asset:${mediaId}` };
              charsChanged = true;
            }
          }
        }
      }
      if (charsChanged) {
        newAssetContext = { ...newAssetContext, characters: updatedChars };
        comicChanged = true;
      }
    }

    if (newAssetContext?.backgrounds) {
      let bgsChanged = false;
      const updatedBgs = { ...newAssetContext.backgrounds };
      for (const [id, bg] of Object.entries(updatedBgs)) {
        if (bg.imageRef?.startsWith("idb:")) {
          const mediaId = bg.imageRef.slice(4);
          const blob = await getMedia(mediaId);
          if (blob) {
            const ok = await uploadAssetToDev(mediaId, blob);
            if (ok) {
              updatedBgs[id] = { ...bg, imageRef: `asset:${mediaId}` };
              bgsChanged = true;
            }
          }
        }
      }
      if (bgsChanged) {
        newAssetContext = { ...newAssetContext, backgrounds: updatedBgs };
        comicChanged = true;
      }
    }

    if (comicChanged) {
      updatedComics.push({ ...c, assetContext: newAssetContext, updatedAt: Date.now() });
      changed = true;
    } else {
      updatedComics.push(c);
    }
  }

  return changed ? updatedComics : null;
}

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
  scheduleDevSync(newComics);
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
    const updatedComics = comicId ? comics.map((c) => (c.id === comicId ? touch(c) : c)) : comics;
    writeComics(updatedComics);
    set({ comics: updatedComics, lastSavedAt: Date.now() });
    void pushComicsToDevSync(updatedComics);
    void get().syncMcpComics();
    const referenced = collectAllReferencedMedia(get());
    void pruneMedia(referenced);
  },

  syncMcpComics: async () => {
    if (typeof window === "undefined") return;
    try {
      let res = await fetch("/__inkframe/comics", { cache: "no-store" });
      if (!res.ok) {
        res = await fetch("/mcp_comics.json", { cache: "no-store" });
      }
      if (!res.ok) return;

      const data = await res.json();
      const mcpComics: Comic[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.comics)
          ? data.comics
          : [];
      if (mcpComics.length === 0) return;

      const deletedIds = readDeletedIds();
      if (data && Array.isArray(data.deletedIds)) {
        for (const id of data.deletedIds) deletedIds.add(id);
      }

      const current = get().comics;
      const { merged, changed } = mergeComics(current, mcpComics, deletedIds);

      if (changed) {
        writeComics(merged);
        set({ comics: merged });
      }
    } catch {
      // ignore network errors
    }
  },

  hydrate: () => {
    if (get().hydrated || typeof window === "undefined") return;
    set({ comics: readComics(), hydrated: true });
    void get().syncMcpComics();
    void (async () => {
      const migrated = await migrateReferencesToAssets(get().comics);
      if (migrated) {
        writeComics(migrated);
        set({ comics: migrated });
        void pushComicsToDevSync(migrated);
      }
    })();
    window.addEventListener("focus", () => void get().syncMcpComics());
    setInterval(() => void get().syncMcpComics(), 2000);
  },

  importComics: (rawJson: string) => {
    try {
      const parsed = JSON.parse(rawJson);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      const valid = items.filter(
        (c) =>
          c && typeof c === "object" && typeof c.id === "string" && typeof c.title === "string",
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
      for (const ref of getComicMediaRefs(target)) {
        void deleteMediaRef(ref);
      }
    }
    const comics = get().comics.filter((c) => c.id !== id);
    const past = (get().past || []).map((list) => list.filter((c) => c.id !== id));
    const future = (get().future || []).map((list) => list.filter((c) => c.id !== id));
    writeComics(comics);
    set({ comics, past, future });
    const referenced = collectAllReferencedMedia({ comics, past, future });
    void pruneMedia(referenced);
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
          scene: panel.scene
            ? {
                ...panel.scene,
                characterIds: panel.scene.characterIds ? [...panel.scene.characterIds] : undefined,
              }
            : undefined,
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

  setPanelScene: (comicId, pageId, panelId, patch) => {
    const comics = mapComic(get().comics, comicId, (c) => ({
      ...c,
      pages: c.pages.map((p) =>
        p.id === pageId
          ? {
              ...p,
              panels: p.panels.map((panel) => {
                if (panel.id !== panelId) return panel;
                if (patch === null) {
                  const { scene: _scene, ...rest } = panel;
                  return rest;
                }
                return {
                  ...panel,
                  scene: {
                    ...(panel.scene ?? {}),
                    ...patch,
                  },
                };
              }),
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
                panel.id === panelId ? { ...panel, bubbles: [...panel.bubbles, bubble] } : panel,
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
    const comics = mapComic(get().comics, comicId, (c) => ({ ...c, cover }));
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

  updateAssetContext: (comicId, patch) => {
    const comics = mapComic(get().comics, comicId, (c) => ({
      ...c,
      assetContext: {
        ...(c.assetContext ?? {}),
        ...patch,
      },
    }));
    pushState(set, get, comics);
  },

  upsertCharacter: (comicId, char) => {
    const comics = mapComic(get().comics, comicId, (c) => {
      const ctx = c.assetContext ?? {};
      return {
        ...c,
        assetContext: {
          ...ctx,
          characters: {
            ...(ctx.characters ?? {}),
            [char.id]: char,
          },
        },
      };
    });
    pushState(set, get, comics);
  },

  deleteCharacter: (comicId, charId) => {
    const comics = mapComic(get().comics, comicId, (c) => deleteCharacterFromComic(c, charId));
    pushState(set, get, comics);
  },

  upsertBackground: (comicId, bg) => {
    const comics = mapComic(get().comics, comicId, (c) => {
      const ctx = c.assetContext ?? {};
      return {
        ...c,
        assetContext: {
          ...ctx,
          backgrounds: {
            ...(ctx.backgrounds ?? {}),
            [bg.id]: bg,
          },
        },
      };
    });
    pushState(set, get, comics);
  },

  deleteBackground: (comicId, bgId) => {
    const comics = mapComic(get().comics, comicId, (c) => deleteBackgroundFromComic(c, bgId));
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
  if (comic.assetContext?.characters) {
    for (const char of Object.values(comic.assetContext.characters)) {
      if (char.imageRef) set.add(char.imageRef);
    }
  }
  if (comic.assetContext?.backgrounds) {
    for (const bg of Object.values(comic.assetContext.backgrounds)) {
      if (bg.imageRef) set.add(bg.imageRef);
    }
  }
  return Array.from(set);
}

/**
 * Gathers every media ref that must be preserved: across all active comics,
 * and across all historical states in the undo/redo stacks.
 */
export function collectAllReferencedMedia(state: {
  comics: Comic[];
  past?: Comic[][];
  future?: Comic[][];
}): Set<string> {
  const set = new Set<string>();
  const addFrom = (list?: Comic[]) => {
    if (!list) return;
    for (const c of list) {
      for (const ref of getComicMediaRefs(c)) set.add(ref);
    }
  };
  addFrom(state.comics);
  for (const hist of state.past ?? []) addFrom(hist);
  for (const hist of state.future ?? []) addFrom(hist);
  return set;
}
