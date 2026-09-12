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
    title: "Night Bus 42",
    author: "Inkframe Studio",
    cover: "url:/demo/cover.jpg",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pages: [
      page("d-p1", "splash", [
        panel("d-p1a", "/demo/p1.jpg", [
          bubble(
            "d-b1",
            "The last bus was supposed to be at 11:40.",
            "caption",
            4,
            4,
            88,
            "none",
          ),
          bubble(
            "d-b2",
            "If the 42 is late again, I'm walking.",
            "speech",
            8,
            68,
            54,
            "br",
          ),
        ]),
      ]),
      page("d-p2", "two-h", [
        panel("d-p2a", "/demo/p2a.jpg", [
          bubble("d-b3", "Come on…", "thought", 10, 8, 52, "bl"),
        ]),
        panel("d-p2b", "/demo/p2b.jpg", [
          bubble("d-b4", "No signal. Of course.", "caption", 5, 78, 90, "none"),
        ]),
      ]),
      page("d-p3", "wide-then-two", [
        panel("d-p3a", "/demo/p3a.jpg", [
          bubble("d-b5", "Headlights. Finally.", "caption", 4, 6, 44, "none"),
        ]),
        panel("d-p3b", "/demo/p3b.jpg", []),
        panel("d-p3c", "/demo/p3c.jpg", [
          bubble("d-b6", "She still has it.", "thought", 8, 8, 70, "bl"),
        ]),
      ]),
      page("d-p4", "two-h", [
        panel("d-p4a", "/demo/p4a.jpg", [
          bubble("d-b7", "That's my handwriting.", "speech", 6, 8, 78, "bl"),
        ]),
        panel("d-p4b", "/demo/p4b.jpg", [
          bubble(
            "d-b8",
            "Then you already know why I'm here.",
            "speech",
            8,
            70,
            82,
            "tl",
          ),
        ]),
      ]),
      page("d-p5", "splash", [
        panel("d-p5a", "/demo/p5.jpg", [
          bubble(
            "d-b9",
            "Two stops left. Plenty of time to start.",
            "caption",
            6,
            82,
            88,
            "none",
          ),
        ]),
      ]),
    ],
  };
}

export const SAMPLE_CLIP = "/demo/sample-clip.mp4";
