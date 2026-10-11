import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { panelAspectRatio } from "./layouts.ts";
import { buildPanelPrompt } from "./prompt-builder.ts";
import { createComic } from "./factory.ts";
import type { CharacterReference, BackgroundReference } from "./types.ts";

describe("Layout Panel Aspect Ratios", () => {
  it("computes accurate aspect ratios for single and multi-panel layouts", () => {
    assert.equal(panelAspectRatio("splash", 0), "2:3");
    assert.equal(panelAspectRatio("two-v", 0), "4:3");
    assert.equal(panelAspectRatio("two-v", 1), "4:3");
    assert.equal(panelAspectRatio("two-h", 0), "1:3");
    assert.equal(panelAspectRatio("two-h", 1), "1:3");
    assert.equal(panelAspectRatio("three-strip", 0), "2:1");
    assert.equal(panelAspectRatio("four-grid", 0), "2:3");
    assert.equal(panelAspectRatio("four-grid", 3), "2:3");
  });

  it("handles complex asymmetric layouts like wide-then-two, two-then-wide, and spotlight", () => {
    assert.equal(panelAspectRatio("wide-then-two", 0), "16:9");
    assert.equal(panelAspectRatio("wide-then-two", 1), "3:4");
    assert.equal(panelAspectRatio("two-then-wide", 0), "3:4");
    assert.equal(panelAspectRatio("two-then-wide", 2), "16:9");
    assert.equal(panelAspectRatio("spotlight", 0), "9:16");
    assert.equal(panelAspectRatio("spotlight", 1), "1:1");
  });
});

describe("AI Prompt Builder (Generic, Midjourney, Flux)", () => {
  function createTestComicFixture() {
    const comic = createComic("Prompt Test Comic", "Author Test");
    comic.assetContext = {
      styleGuide: "Dark graphic novel noir with heavy ink cross-hatching",
      backgrounds: {
        rainy_alley: {
          id: "rainy_alley",
          name: "Rainy Alleyway",
          description: "Wet asphalt, neon reflections, steam rising from grates",
          imageRef: "asset:alley_ref_1",
        } as BackgroundReference,
      },
      characters: {
        elena: {
          id: "elena",
          name: "Elena Vance",
          role: "Detective",
          appearance: "Late 20s cyber runner",
          traits: {
            face: "Sharp jawline, tired eyes",
            hair: "Black messy bob",
            build: "Athletic",
            age: "29",
          },
          signatureOutfit: "Charcoal trench coat and fingerless gloves",
          invariants: ["Cyan mechanical right eye", "Scar over left brow"],
          imageRef: "asset:elena_ref_1",
        } as CharacterReference,
      },
    };

    const page = comic.pages[0];
    page.panels[0].scene = {
      characterIds: ["elena"],
      backgroundId: "rainy_alley",
      shot: "close-up",
      action: "Elena checks her cybernetic optic in the shattered mirror",
    };

    return comic;
  }

  it("builds generic structured bracketed prompt with all continuity elements", () => {
    const comic = createTestComicFixture();
    const result = buildPanelPrompt(comic, comic.pages[0].id, 0, {
      target: "generic",
    });

    assert.equal(result.target, "generic");
    assert.ok(result.compiledPrompt.includes("[ART STYLE]: Dark graphic novel noir"));
    assert.ok(result.compiledPrompt.includes("[CAMERA SHOT]: close-up"));
    assert.ok(result.compiledPrompt.includes("[SETTING (Rainy Alleyway)]: Wet asphalt"));
    assert.ok(result.compiledPrompt.includes("Elena Vance (Late 20s cyber runner)"));
    assert.ok(
      result.compiledPrompt.includes("Invariants: Cyan mechanical right eye; Scar over left brow"),
    );
    assert.ok(result.compiledPrompt.includes("[SCENE ACTION]: Elena checks her cybernetic optic"));
    assert.ok(result.compiledPrompt.includes("[ASPECT RATIO]:"));
    assert.equal(result.referenceImages.length, 2); // 1 bg, 1 character
    assert.equal(result.warnings.length, 0);
  });

  it("builds Midjourney v6 prompt with --ar aspect ratio parameters", () => {
    const comic = createTestComicFixture();
    const result = buildPanelPrompt(comic, comic.pages[0].id, 0, {
      target: "midjourney",
    });

    assert.equal(result.target, "midjourney");
    assert.ok(result.compiledPrompt.includes("close-up camera shot"));
    assert.ok(result.compiledPrompt.includes("featuring Elena Vance"));
    assert.ok(result.compiledPrompt.includes("set in Rainy Alleyway"));
    assert.ok(result.compiledPrompt.includes("--ar"));
    assert.ok(result.parameters?.["--ar"]);
  });

  it("builds Flux / SDXL prompt with positive tokens and negative prompt", () => {
    const comic = createTestComicFixture();
    const result = buildPanelPrompt(comic, comic.pages[0].id, 0, {
      target: "flux-sd",
    });

    assert.equal(result.target, "flux-sd");
    assert.ok(result.compiledPrompt.includes("Dark graphic novel noir"));
    assert.ok(result.compiledPrompt.includes("close-up view"));
    assert.ok(result.compiledPrompt.includes("Elena Vance"));
    assert.ok(result.negativePrompt);
    assert.ok(result.negativePrompt.includes("blurry"));
    assert.ok(result.negativePrompt.includes("bad anatomy"));
  });

  it("warns on missing action, missing style guide, or undefined character/location IDs", () => {
    const comic = createComic("Empty Comic", "Author Empty");
    comic.assetContext = {
      styleGuide: "",
      backgrounds: {},
      characters: {},
    };
    const result = buildPanelPrompt(comic, undefined, undefined, {
      target: "generic",
      backgroundId: "nonexistent_loc",
      characterIds: ["ghost_char"],
      actionDescription: "",
    });

    assert.ok(result.warnings.some((w) => w.includes("master art style guide")));
    assert.ok(result.warnings.some((w) => w.includes("No action description")));
    assert.ok(result.warnings.some((w) => w.includes("nonexistent_loc")));
    assert.ok(result.warnings.some((w) => w.includes("ghost_char")));
  });
});
