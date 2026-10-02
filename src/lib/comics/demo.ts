import { defaultCoverConfig } from "./factory";
import type { Comic, Page, Panel, SpeechBubble } from "./types";

const DEMO_ID = "demo-night-bus-42";

function bubble(
  id: string,
  text: string,
  kind: SpeechBubble["kind"],
  x: number,
  y: number,
  w: number,
  tail: SpeechBubble["tail"],
): SpeechBubble {
  return { id, text, kind, x, y, w, tail };
}

function panel(
  id: string,
  image: string,
  bubbles: SpeechBubble[],
): Panel {
  return { id, image: `url:${image}`, filter: "none", bubbles };
}

function page(id: string, layout: Page["layout"], panels: Panel[]): Page {
  return { id, layout, panels };
}

export function createDemoComic(): Comic {
  return {
    id: DEMO_ID,
    title: "Last One Out",
    author: "Inkframe Studio",
    cover: "url:/demo/cover.jpg",
    coverConfig: {
      ...defaultCoverConfig(),
      template: "classic",
      titleStyle: "classic-3d",
      tagline: "A LATE-SHIFT HORROR",
      subtitle: "THE CRY WAS NOT A CHILD",
      titleColor: "#fef08a",
      accentColor: "#dc2626",
    },
    assetContext: {
      styleGuide:
        "Cel-shaded anime, night city sidewalk, bold ink and flat color. Adult woman in a navy business suit. Fictional. No gore.",
      backgrounds: {},
      characters: {},
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pages: [
      page("d-p1", "splash", [
        panel("d-p1a", "/demo/p1.jpg", [
          bubble(
            "d-b1",
            "11:47 PM — last one out. Office tower, business dress, empty sidewalk. No one else leaves.",
            "title-banner",
            3,
            2,
            94,
            "none",
          ),
          bubble(
            "d-b2",
            "Lobby dark. Door locks behind her.",
            "caption",
            4,
            30,
            58,
            "none",
          ),
          bubble("d-b3", "Bag. Keys. Subway. Home.", "thought", 38, 37.9164, 62, "bl"),
        ]),
      ]),
      page("d-p2", "splash", [
        panel("d-p2a", "/demo/p2.jpg", [
          bubble(
            "d-b4",
            "Four blocks. No one. Her heels are the only sound between her and the station.",
            "title-banner",
            3,
            2,
            94,
            "none",
          ),
          bubble(
            "d-b5",
            "Shops shut. Signals green for nothing.",
            "caption",
            3.3014,
            19.432,
            62,
            "none",
          ),
          bubble("d-b6", "Too quiet. Don’t look back.", "thought", 33.7532, 33.1476, 64, "bl"),
        ]),
      ]),
      page("d-p3", "splash", [
        panel("d-p3a", "/demo/p3.jpg", [
          bubble(
            "d-b7",
            "Drip. Drip. Drip. She slows. The drip is regular. Something sits under it.",
            "title-banner",
            3,
            2,
            94,
            "none",
          ),
          bubble(
            "d-b8",
            "Pipe overhead. Water on concrete.",
            "caption",
            2.3806,
            8.091,
            62,
            "none",
          ),
          bubble("d-b9", "Just a leak. Keep walking.", "thought", 35.53, 28.073, 64, "bl"),
        ]),
      ]),
      page("d-p4", "splash", [
        panel("d-p4a", "/demo/p4.jpg", [
          bubble(
            "d-b10",
            "She leaves the subway path and follows the sound into the side street.",
            "title-banner",
            3,
            2,
            94,
            "none",
          ),
          bubble("d-b10b", "…Mommy…", "shout", 60, 43.391, 40, "none"),
          bubble(
            "d-b11",
            "Thin. Close. Not on the street. She runs.",
            "caption",
            52,
            6.304,
            48,
            "none",
          ),
          bubble("d-b12", "A kid? Out here?", "thought", 1.8694, 7.7104, 46, "bl"),
          bubble("d-b13", "Don’t think. Find them.", "thought", 2.9508, 14.0714, 64, "bl"),
        ]),
      ]),
      page("d-p5", "splash", [
        panel("d-p5a", "/demo/p5.jpg", [
          bubble(
            "d-b14",
            "No child. A toy on wet pavement. No footprints. No voice left.",
            "title-banner",
            3,
            2,
            94,
            "none",
          ),
          bubble(
            "d-b15",
            "Cry stops the moment she sees it.",
            "caption",
            2.7413,
            8.1003,
            62,
            "none",
          ),
          bubble(
            "d-b16",
            "Where are you? Who left this?",
            "thought",
            5.4575,
            25.6686,
            68,
            "bl",
          ),
        ]),
      ]),
      page("d-p6", "splash", [
        panel("d-p6a", "/demo/p6.jpg", [
          bubble(
            "d-b17",
            "Lights out. Street, windows, signals — all dead. She cannot see the way back.",
            "title-banner",
            3,
            2,
            94,
            "none",
          ),
          bubble("d-b18", "Whole block. At once.", "caption", 2.4988, 8.6762, 52, "none"),
          bubble("d-b19", "No. No, no—", "thought", 20.1343, 24.1746, 48, "bl"),
        ]),
      ]),
      page("d-p7", "splash", [
        panel("d-p7a", "/demo/p7.jpg", [
          bubble(
            "d-b20",
            "Weight on the shoulder. Nails through the dress.",
            "caption",
            4,
            4,
            70,
            "none",
          ),
          bubble(
            "d-b21",
            "It was behind me the whole time.",
            "thought",
            0.7731,
            44.9616,
            72,
            "bl",
          ),
        ]),
      ]),
    ],
  };
}

export const SAMPLE_CLIP = "/demo/sample-clip.mp4";
