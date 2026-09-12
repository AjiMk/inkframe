import { nid } from "@/lib/utils";
import { LAYOUTS } from "./layouts";
import type {
  Comic,
  Page,
  PageLayoutId,
  Panel,
  PanelFilter,
  SpeechBubble,
  BubbleKind,
  TailDir,
} from "./types";

export function emptyPanel(): Panel {
  return { id: nid(), image: null, filter: "none", bubbles: [] };
}

export function createPage(layout: PageLayoutId = "splash"): Page {
  const count = LAYOUTS[layout].panelCount;
  return {
    id: nid(),
    layout,
    panels: Array.from({ length: count }, () => emptyPanel()),
  };
}

export function createComic(title: string, author: string): Comic {
  const now = Date.now();
  return {
    id: nid(),
    title: title.trim() || "Untitled",
    author: author.trim() || "Anonymous",
    cover: null,
    pages: [createPage("splash")],
    createdAt: now,
    updatedAt: now,
  };
}

export function fitPanelsToLayout(page: Page, layout: PageLayoutId): Page {
  const n = LAYOUTS[layout].panelCount;
  const panels = page.panels.slice(0, n);
  while (panels.length < n) panels.push(emptyPanel());
  return { ...page, layout, panels };
}

export function createBubble(
  kind: BubbleKind = "speech",
  text = "Write dialogue…",
): SpeechBubble {
  const presets: Record<
    BubbleKind,
    { x: number; y: number; w: number; tail: TailDir }
  > = {
    speech: { x: 8, y: 8, w: 42, tail: "bl" },
    thought: { x: 50, y: 6, w: 40, tail: "br" },
    shout: { x: 18, y: 12, w: 56, tail: "none" },
    caption: { x: 4, y: 4, w: 92, tail: "none" },
  };
  return { id: nid(), text, kind, ...presets[kind] };
}

export function coverRef(comic: Comic): string | null {
  if (comic.cover) return comic.cover;
  for (const page of comic.pages) {
    for (const panel of page.panels) {
      if (panel.image) return panel.image;
    }
  }
  return null;
}

export const FILTERS: { id: PanelFilter; label: string }[] = [
  { id: "none", label: "Full color" },
  { id: "ink", label: "Ink wash" },
  { id: "noir", label: "Noir" },
  { id: "halftone", label: "Halftone" },
  { id: "sepia", label: "Newsprint" },
];
