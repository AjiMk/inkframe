import { create } from "zustand";
import { createDemoComic } from "./demo";
import {
  createBubble,
  createComic,
  createPage,
  fitPanelsToLayout,
} from "./factory";
import { deleteMediaRef } from "./media";
import type {
  BubbleKind,
  Comic,
  FaceReplacement,
  PageLayoutId,
  PanelFilter,
  SpeechBubble,
} from "./types";

const KEY = "inkframe.comics.v1";

function readComics(): Comic[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return [createDemoComic()];
    const parsed = JSON.parse(raw) as Comic[];
    return Array.isArray(parsed) ? parsed : [createDemoComic()];
  } catch {
    return [createDemoComic()];
  }
}

function writeComics(comics: Comic[]) {
  localStorage.setItem(KEY, JSON.stringify(comics));
}

function touch(comic: Comic): Comic {
  return { ...comic, updatedAt: Date.now() };
}

function mapComic(comics: Comic[], id: string, fn: (c: Comic) => Comic): Comic[] {
  return comics.map((c) => (c.id === id ? touch(fn(c)) : c));
}

interface ComicState {
  comics: Comic[];
  hydrated: boolean;
  hydrate: () => void;
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
  replacePanelFace: (
    comicId: string,
    pageId: string,
    panelId: string,
    replacementImage: string,
    faceReplacement: FaceReplacement,
  ) => void;
  resetPanelFace: (comicId: string, pageId: string, panelId: string) => void;
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
}

export const useComicStore = create<ComicState>((set, get) => ({
  comics: [],
  hydrated: false,

  hydrate: () => {
    if (get().hydrated || typeof window === "undefined") return;
    set({ comics: readComics(), hydrated: true });
  },

  create: (title, author) => {
    const comic = createComic(title, author);
    const comics = [comic, ...get().comics];
    writeComics(comics);
    set({ comics });
    return comic.id;
  },

  restoreDemo: () => {
    const demo = createDemoComic();
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
    writeComics(comics);
    set({ comics });
  },

  remove: (id) => {
    const target = get().comics.find((c) => c.id === id);
    if (target) {
      void deleteMediaRef(target.cover);
      for (const page of target.pages) {
        for (const panel of page.panels) void deleteMediaRef(panel.image);
      }
    }
    const comics = get().comics.filter((c) => c.id !== id);
    writeComics(comics);
    set({ comics });
  },

  addPage: (comicId, layout = "splash") => {
    const page = createPage(layout);
    const comics = mapComic(get().comics, comicId, (c) => ({
      ...c,
      pages: [...c.pages, page],
    }));
    writeComics(comics);
    set({ comics });
    return page.id;
  },

  removePage: (comicId, pageId) => {
    const comics = mapComic(get().comics, comicId, (c) => {
      if (c.pages.length <= 1) return c;
      return { ...c, pages: c.pages.filter((p) => p.id !== pageId) };
    });
    writeComics(comics);
    set({ comics });
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
    writeComics(comics);
    set({ comics });
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
    writeComics(comics);
    set({ comics });
  },

  reversePages: (comicId) => {
    const comics = mapComic(get().comics, comicId, (c) => ({
      ...c,
      pages: [...c.pages].reverse(),
    }));
    writeComics(comics);
    set({ comics });
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
    writeComics(comics);
    set({ comics });
  },

  setLayout: (comicId, pageId, layout) => {
    const comics = mapComic(get().comics, comicId, (c) => ({
      ...c,
      pages: c.pages.map((p) => (p.id === pageId ? fitPanelsToLayout(p, layout) : p)),
    }));
    writeComics(comics);
    set({ comics });
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
              originalImage: image ? (panel.originalImage ?? image) : null,
              faceReplacements: image ? panel.faceReplacements : [],
            };
          }),
        };
      }),
    }));
    writeComics(comics);
    set({ comics });
  },

  replacePanelFace: (comicId, pageId, panelId, replacementImage, faceReplacement) => {
    const comics = mapComic(get().comics, comicId, (c) => ({
      ...c,
      pages: c.pages.map((p) => {
        if (p.id !== pageId) return p;
        return {
          ...p,
          panels: p.panels.map((panel) => {
            if (panel.id !== panelId) return panel;
            const originalImage = panel.originalImage || panel.image || replacementImage;
            const existingReplacements = panel.faceReplacements || [];
            return {
              ...panel,
              image: replacementImage,
              originalImage,
              faceReplacements: [...existingReplacements, faceReplacement],
            };
          }),
        };
      }),
    }));
    writeComics(comics);
    set({ comics });
  },

  resetPanelFace: (comicId, pageId, panelId) => {
    const comics = mapComic(get().comics, comicId, (c) => ({
      ...c,
      pages: c.pages.map((p) => {
        if (p.id !== pageId) return p;
        return {
          ...p,
          panels: p.panels.map((panel) => {
            if (panel.id !== panelId) return panel;
            const restoredImage = panel.originalImage || panel.image;
            return {
              ...panel,
              image: restoredImage,
              faceReplacements: [],
            };
          }),
        };
      }),
    }));
    writeComics(comics);
    set({ comics });
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
    writeComics(comics);
    set({ comics });
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
    writeComics(comics);
    set({ comics });
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
    writeComics(comics);
    set({ comics });
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
    writeComics(comics);
    set({ comics });
  },

  setCover: (comicId, cover) => {
    const comics = mapComic(get().comics, comicId, (c) => {
      if (c.cover && c.cover !== cover) void deleteMediaRef(c.cover);
      return { ...c, cover };
    });
    writeComics(comics);
    set({ comics });
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

