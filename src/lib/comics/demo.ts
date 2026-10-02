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
            "11:47 PM. Forty stories of glass and steel fall dead silent. The last shift ends.",
            "title-banner",
            3,
            2,
            94,
            "none",
          ),
          bubble(
            "d-b2",
            "The heavy glass lobby doors lock automatically behind me.",
            "caption",
            4,
            30,
            58,
            "none",
          ),
          bubble("d-b3", "Keys. Phone. Purse. Just make it to the train...", "thought", 8, 78, 62, "bl"),
        ]),
      ]),
      page("d-p2", "splash", [
        panel("d-p2a", "/demo/p2.jpg", [
          bubble(
            "d-b4",
            "Four blocks to the station. Every sharp click of my heels echoes off the darkened storefronts.",
            "title-banner",
            3,
            2,
            94,
            "none",
          ),
          bubble(
            "d-b5",
            "Traffic signals cycle green for streets abandoned for hours.",
            "caption",
            4,
            30,
            62,
            "none",
          ),
          bubble("d-b6", "It’s too quiet tonight. Don’t look back.", "thought", 8, 78, 64, "bl"),
        ]),
      ]),
      page("d-p3", "splash", [
        panel("d-p3a", "/demo/p3.jpg", [
          bubble(
            "d-b7",
            "Drip... drip... drip. A heavy, rhythmic tapping cuts through the freezing fog.",
            "title-banner",
            3,
            2,
            94,
            "none",
          ),
          bubble(
            "d-b8",
            "Subway steam vents hiss softly into the empty street.",
            "caption",
            4,
            30,
            62,
            "none",
          ),
          bubble("d-b9", "Just condensation from a pipe. Keep moving.", "thought", 8, 78, 64, "bl"),
        ]),
      ]),
      page("d-p4", "splash", [
        panel("d-p4a", "/demo/p4.jpg", [
          bubble(
            "d-b10",
            "Curiosity overrides caution as a faint voice turns down the narrow alleyway.",
            "title-banner",
            3,
            2,
            94,
            "none",
          ),
          bubble("d-b10b", "…Mommy…?", "shout", 54, 34, 40, "none"),
          bubble(
            "d-b11",
            "High, fragile... a child's cry, impossibly close.",
            "caption",
            4,
            22,
            48,
            "none",
          ),
          bubble("d-b12", "A kid? Out here at midnight?", "thought", 6, 64, 46, "bl"),
          bubble("d-b13", "I can't ignore them. Hello?!", "thought", 28, 80, 64, "br"),
        ]),
      ]),
      page("d-p5", "splash", [
        panel("d-p5a", "/demo/p5.jpg", [
          bubble(
            "d-b14",
            "The alley is a dead end. No child... only a waterlogged porcelain doll.",
            "title-banner",
            3,
            2,
            94,
            "none",
          ),
          bubble(
            "d-b15",
            "The weeping stops dead the instant my shadow touches it.",
            "caption",
            4,
            28,
            62,
            "none",
          ),
          bubble(
            "d-b16",
            "No footprints... no shadow. Where did the voice come from?",
            "thought",
            8,
            78,
            68,
            "bl",
          ),
        ]),
      ]),
      page("d-p6", "splash", [
        panel("d-p6a", "/demo/p6.jpg", [
          bubble(
            "d-b17",
            "SNAP. The streetlights plunge the entire block into pitch darkness.",
            "title-banner",
            3,
            2,
            94,
            "none",
          ),
          bubble("d-b18", "Not a single window glowing. Absolute silence.", "caption", 4, 30, 52, "none"),
          bubble("d-b19", "I can't see the street... I can't see my hands...", "thought", 8, 78, 48, "bl"),
        ]),
      ]),
      page("d-p7", "splash", [
        panel("d-p7a", "/demo/p7.jpg", [
          bubble(
            "d-b20",
            "An icy, agonizing weight drops onto my shoulder. Cold fingers claw into fabric.",
            "caption",
            4,
            4,
            70,
            "none",
          ),
          bubble(
            "d-b21",
            "It didn't lure me into the alley... it was waiting for me to stop.",
            "thought",
            8,
            78,
            72,
            "bl",
          ),
        ]),
      ]),
    ],
  };
}

export const SAMPLE_CLIP = "/demo/sample-clip.mp4";
