export type BubbleKind =
  "speech" | "thought" | "shout" | "caption" | "sfx" | "title-banner" | "burst-label";

export type TailDir = "bl" | "br" | "tl" | "tr" | "none";

export type PanelFilter =
  | "none"
  | "ink"
  | "noir"
  | "halftone"
  | "sepia"
  | "vintage"
  | "pop-art"
  | "cyber-neon"
  | "graphic-novel"
  | "anime-cel"
  | "pencil-sketch"
  | "manga-screentone"
  | "anaglyph-3d"
  | "golden-pulp"
  | "dark-knight"
  | "technicolor";

export type CoverTemplateStyle = "classic" | "action" | "vintage" | "pulp" | "graphic-novel";

export interface CoverElementPosition {
  x: number;
  y: number;
}

export interface CoverConfig {
  template: CoverTemplateStyle;
  titleStyle: "classic-3d" | "retro-bold" | "neon-glitch" | "distressed-pulp";
  issueNumber: string;
  issuePrice: string;
  issueDate: string;
  publisherName: string;
  tagline: string;
  subtitle: string;
  showComicsCode: boolean;
  showBarcode: boolean;
  titleColor: string;
  accentColor: string;
  positions?: Record<string, CoverElementPosition>;
}

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
  speakerId?: string;
}

export type ShotType =
  | "establishing"
  | "wide"
  | "medium"
  | "close-up"
  | "extreme-close-up"
  | "low-angle"
  | "high-angle"
  | "over-shoulder"
  | "dutch";

export interface PanelScene {
  characterIds?: string[];
  backgroundId?: string;
  shot?: ShotType;
  action?: string;
  outfitByCharacter?: Record<string, string>;
}

export interface Panel {
  id: string;
  image: string | null;
  filter: PanelFilter;
  bubbles: SpeechBubble[];
  scene?: PanelScene;
}

export interface Page {
  id: string;
  layout: PageLayoutId;
  panels: Panel[];
}

export interface BackgroundReference {
  id: string;
  name: string;
  description: string;
  imageRef?: string;
}

export interface CharacterOutfit {
  id: string;
  label: string;
  description: string;
}

export interface CharacterTraits {
  face?: string;
  hair?: string;
  build?: string;
  age?: string;
}

export interface CharacterReference {
  id: string;
  name: string;
  role?: string;
  appearance: string;
  aliases?: string[];
  traits?: CharacterTraits;
  signatureOutfit?: string;
  palette?: string[];
  invariants?: string[];
  outfits?: CharacterOutfit[];
  voice?: string;
  imageRef?: string;
}

export interface AssetReferenceContext {
  styleGuide?: string;
  backgrounds?: Record<string, BackgroundReference>;
  characters?: Record<string, CharacterReference>;
}

export interface Comic {
  id: string;
  title: string;
  author: string;
  cover: string | null;
  coverConfig?: CoverConfig;
  assetContext?: AssetReferenceContext;
  pages: Page[];
  createdAt: number;
  updatedAt: number;
}

export interface Selection {
  pageId: string | null;
  panelId: string | null;
  bubbleId: string | null;
}
