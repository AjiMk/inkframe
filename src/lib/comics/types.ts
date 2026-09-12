export type BubbleKind = "speech" | "thought" | "shout" | "caption";
export type TailDir = "bl" | "br" | "tl" | "tr" | "none";
export type PanelFilter = "none" | "ink" | "noir" | "halftone" | "sepia";

export type PageLayoutId =
  | "splash"
  | "two-v"
  | "two-h"
  | "three-strip"
  | "four-grid"
  | "wide-then-two"
  | "two-then-wide"
  | "spotlight";

export interface SpeechBubble {
  id: string;
  text: string;
  x: number;
  y: number;
  w: number;
  kind: BubbleKind;
  tail: TailDir;
}

export interface Panel {
  id: string;
  image: string | null;
  filter: PanelFilter;
  bubbles: SpeechBubble[];
}

export interface Page {
  id: string;
  layout: PageLayoutId;
  panels: Panel[];
}

export interface Comic {
  id: string;
  title: string;
  author: string;
  cover: string | null;
  pages: Page[];
  createdAt: number;
  updatedAt: number;
}

export interface Selection {
  pageId: string | null;
  panelId: string | null;
  bubbleId: string | null;
}
