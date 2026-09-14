import { nid } from "@/lib/utils";
import { LAYOUTS } from "./layouts";
import type {
  Comic,
  CoverConfig,
  Page,
  PageLayoutId,
  Panel,
  PanelFilter,
  SpeechBubble,
  BubbleKind,
  TailDir,
} from "./types";

export function defaultCoverConfig(): CoverConfig {
  return {
    template: "classic",
    titleStyle: "classic-3d",
    issueNumber: "#1",
    issuePrice: "25¢",
    issueDate: "VOL. 1",
    publisherName: "INKFRAME COMICS",
    tagline: "SPECIAL COLLECTOR'S EDITION!",
    subtitle: "THE EXTRAORDINARY TALES BEGIN!",
    showComicsCode: true,
    showBarcode: true,
    titleColor: "#facc15",
    accentColor: "#dc2626",
    positions: {
      issueBox: { x: 3, y: 3 },
      tagline: { x: 22, y: 3 },
      comicsCode: { x: 82, y: 3 },
      title: { x: 4, y: 15 },
      subtitle: { x: 12, y: 28 },
      authorBadge: { x: 3, y: 86 },
      barcode: { x: 74, y: 84 },
    },
  };
}

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
    coverConfig: defaultCoverConfig(),
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
  text?: string,
): SpeechBubble {
  const presets: Record<
    BubbleKind,
    { text: string; x: number; y: number; w: number; tail: TailDir }
  > = {
    speech: { text: "Write dialogue…", x: 8, y: 8, w: 42, tail: "bl" },
    thought: { text: "Pondering...", x: 50, y: 6, w: 40, tail: "br" },
    shout: { text: "HEY!", x: 18, y: 12, w: 56, tail: "none" },
    caption: { text: "Write caption…", x: 4, y: 4, w: 92, tail: "none" },
    sfx: { text: "KAPOW!", x: 25, y: 35, w: 50, tail: "none" },
    "title-banner": { text: "MEANWHILE...", x: 4, y: 4, w: 92, tail: "none" },
    "burst-label": { text: "SPECIAL!", x: 10, y: 10, w: 35, tail: "none" },
  };

  const defaultValues = presets[kind];
  return {
    id: nid(),
    text: text ?? defaultValues.text,
    kind,
    x: defaultValues.x,
    y: defaultValues.y,
    w: defaultValues.w,
    tail: defaultValues.tail,
  };
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
  { id: "noir", label: "Noir B&W" },
  { id: "halftone", label: "Dot halftone" },
  { id: "sepia", label: "Newsprint" },
  { id: "vintage", label: "70s Vintage" },
  { id: "pop-art", label: "Pop Art" },
  { id: "cyber-neon", label: "Cyber Neon" },
  { id: "graphic-novel", label: "Graphic Ink" },
  { id: "anime-cel", label: "Anime Cel" },
  { id: "pencil-sketch", label: "Pencil Sketch" },
];
