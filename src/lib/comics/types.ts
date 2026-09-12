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

export interface FaceReplacement {
  faceId: string;
  faceBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  replacementFaceSrc: string;
  scale?: number;
  rotation?: number;
  mirror?: boolean;
  feather?: number;
  opacity?: number;
  matchTone?: boolean;
}

export interface Panel {
  id: string;
  image: string | null;
  originalImage?: string | null;
  filter: PanelFilter;
  bubbles: SpeechBubble[];
  faceReplacements?: FaceReplacement[];
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

export interface FaceSetFace {
  id: string;
  name: string;
  src: string;
}

export interface FaceSet {
  id: string;
  name: string;
  sourcePhoto: string | null;
  faces: FaceSetFace[];
  createdAt: number;
}

export interface NormBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NormPoint {
  x: number;
  y: number;
}
