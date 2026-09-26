import type { PageLayoutId } from "./types.ts";

export interface LayoutDef {
  id: PageLayoutId;
  label: string;
  panelCount: number;
  columns: string;
  rows: string;
  areas: string;
}

export const LAYOUTS: Record<PageLayoutId, LayoutDef> = {
  splash: {
    id: "splash",
    label: "Splash",
    panelCount: 1,
    columns: "1fr",
    rows: "1fr",
    areas: `"a"`,
  },
  "two-v": {
    id: "two-v",
    label: "Stack",
    panelCount: 2,
    columns: "1fr",
    rows: "1fr 1fr",
    areas: `"a" "b"`,
  },
  "two-h": {
    id: "two-h",
    label: "Split",
    panelCount: 2,
    columns: "1fr 1fr",
    rows: "1fr",
    areas: `"a b"`,
  },
  "three-strip": {
    id: "three-strip",
    label: "Strip",
    panelCount: 3,
    columns: "1fr",
    rows: "1fr 1fr 1fr",
    areas: `"a" "b" "c"`,
  },
  "four-grid": {
    id: "four-grid",
    label: "Grid",
    panelCount: 4,
    columns: "1fr 1fr",
    rows: "1fr 1fr",
    areas: `"a b" "c d"`,
  },
  "wide-then-two": {
    id: "wide-then-two",
    label: "Wide top",
    panelCount: 3,
    columns: "1fr 1fr",
    rows: "1.25fr 1fr",
    areas: `"a a" "b c"`,
  },
  "two-then-wide": {
    id: "two-then-wide",
    label: "Wide bottom",
    panelCount: 3,
    columns: "1fr 1fr",
    rows: "1fr 1.25fr",
    areas: `"a b" "c c"`,
  },
  spotlight: {
    id: "spotlight",
    label: "Spotlight",
    panelCount: 3,
    columns: "1.45fr 1fr",
    rows: "1fr 1fr",
    areas: `"a b" "a c"`,
  },
};

export const LAYOUT_LIST = Object.values(LAYOUTS);

export const AREA_NAMES = ["a", "b", "c", "d"] as const;
