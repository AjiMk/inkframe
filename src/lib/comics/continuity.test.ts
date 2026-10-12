import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  checkContinuity,
  deleteCharacterFromComic,
  deleteBackgroundFromComic,
} from "./continuity.ts";
import { createComic, createPage } from "./factory.ts";
import { createDemoComic } from "./demo.ts";
import type { Comic } from "./types.ts";

function createFullyConsistentComic(): Comic {
  const comic = createComic("Continuity Masterpiece", "Test Creator");
  comic.assetContext = {
    styleGuide: "Crisp cel-shaded comic line art with cinematic rim lighting",
    characters: {
      elena: {
        id: "elena",
        name: "Elena Vance",
        role: "Lead Detective",
        appearance: "Sharp features, dark coat, athletic build",
        imageRef: "asset:elena-portrait-uuid",
        invariants: ["Scar over left eyebrow", "Amber eyes"],
        traits: {
          face: "Angular jawline",
          hair: "Black pixie cut",
          build: "Athletic",
          age: "32",
        },
        voice: "Gruff, concise, detective noir cadence",
      },
      marcus: {
        id: "marcus",
        name: "Marcus Cole",
        role: "Tech Specialist",
        appearance: "Hooded runner jacket, cyan visor",
        imageRef: "asset:marcus-portrait-uuid",
        invariants: ["Cyan visor glowing faintly"],
      },
    },
    backgrounds: {
      "neon-alley": {
        id: "neon-alley",
        name: "Neon Alley",
        description: "Dark rainy alley with magenta neon signs and puddles reflecting light",
        imageRef: "asset:neon-alley-uuid",
      },
    },
  };

  const page = createPage("splash");
  page.panels[0].image = "asset:rendered-panel-1";
  page.panels[0].scene = {
    characterIds: ["elena", "marcus"],
    backgroundId: "neon-alley",
    shot: "medium",
    action: "Elena examines a broken datapad while Marcus scans the alleyway",
    outfitByCharacter: { elena: "detective-coat" },
  };
  page.panels[0].bubbles = [
    {
      id: "bubble-1",
      text: "The datapad was wiped recently.",
      x: 10,
      y: 15,
      w: 120,
      kind: "speech",
      tail: "bl",
      speakerId: "elena",
    },
  ];

  comic.pages = [page];
  return comic;
}

describe("Continuity Auditor (checkContinuity)", () => {
  it("passes cleanly with zero errors and zero warnings on a fully consistent comic", () => {
    const comic = createFullyConsistentComic();
    const report = checkContinuity(comic);

    assert.equal(report.passed, true);
    assert.equal(report.issueCount.errors, 0);
    assert.equal(report.issueCount.warnings, 0);
    assert.equal(report.stats.totalPages, 1);
    assert.equal(report.stats.totalPanels, 1);
    assert.equal(report.stats.panelsWithScene, 1);
    assert.equal(report.stats.panelsWithImage, 1);
    assert.equal(report.stats.totalCharacters, 2);
    assert.equal(report.stats.usedCharacters, 2);
    assert.equal(report.stats.totalBackgrounds, 1);
    assert.equal(report.stats.usedBackgrounds, 1);
  });

  it("warns when style guide is empty or missing", () => {
    const comic = createFullyConsistentComic();
    comic.assetContext!.styleGuide = "";
    const report = checkContinuity(comic);

    assert.equal(report.passed, true); // warnings do not fail passed flag
    const styleIssue = report.issues.find((i) => i.type === "missing-style-guide");
    assert.ok(styleIssue);
    assert.equal(styleIssue.severity, "warning");
  });

  it("flags character missing reference image and invariants", () => {
    const comic = createFullyConsistentComic();
    comic.assetContext!.characters!.elena.imageRef = undefined;
    comic.assetContext!.characters!.elena.invariants = [];
    comic.assetContext!.characters!.elena.traits = undefined;

    const report = checkContinuity(comic);
    const imgIssue = report.issues.find(
      (i) => i.type === "missing-character-image" && i.characterId === "elena",
    );
    const invIssue = report.issues.find(
      (i) => i.type === "missing-character-invariants" && i.characterId === "elena",
    );

    assert.ok(imgIssue);
    assert.equal(imgIssue.severity, "warning");
    assert.ok(invIssue);
    assert.equal(invIssue.severity, "warning");
  });

  it("warns when a panel has rendered artwork but no scene continuity", () => {
    const comic = createFullyConsistentComic();
    comic.pages[0].panels[0].scene = undefined;

    const report = checkContinuity(comic);
    const noSceneIssue = report.issues.find((i) => i.type === "image-without-scene");
    assert.ok(noSceneIssue);
    assert.equal(noSceneIssue.severity, "warning");
  });

  it("reports error when panel scene references unknown character or location IDs", () => {
    const comic = createFullyConsistentComic();
    comic.pages[0].panels[0].scene = {
      characterIds: ["ghost-character"],
      backgroundId: "lost-city",
      action: "Mysterious scene",
    };

    const report = checkContinuity(comic);
    assert.equal(report.passed, false);
    assert.equal(report.issueCount.errors, 2);

    const charErr = report.issues.find((i) => i.type === "missing-character-ref");
    const bgErr = report.issues.find((i) => i.type === "missing-background-ref");
    assert.ok(charErr);
    assert.equal(charErr.characterId, "ghost-character");
    assert.ok(bgErr);
    assert.equal(bgErr.backgroundId, "lost-city");
  });

  it("reports error for unknown bubble speaker and info when speaker is off-roster", () => {
    const comic = createFullyConsistentComic();
    // bubble with unknown speaker
    comic.pages[0].panels[0].bubbles.push({
      id: "bubble-unknown",
      text: "Who speaks here?",
      x: 20,
      y: 20,
      w: 100,
      kind: "speech",
      tail: "br",
      speakerId: "phantom-voice",
    });

    // marcus is a valid character, but remove him from panel's characterIds to trigger speaker-not-in-scene
    comic.pages[0].panels[0].scene!.characterIds = ["elena"];
    comic.pages[0].panels[0].bubbles.push({
      id: "bubble-marcus",
      text: "Over the radio, Elena!",
      x: 30,
      y: 30,
      w: 120,
      kind: "speech",
      tail: "tl",
      speakerId: "marcus",
    });

    const report = checkContinuity(comic);
    const unknownErr = report.issues.find((i) => i.type === "unknown-speaker");
    assert.ok(unknownErr);
    assert.equal(unknownErr.severity, "error");
    assert.equal(unknownErr.characterId, "phantom-voice");

    const offRosterNote = report.issues.find((i) => i.type === "speaker-not-in-scene");
    assert.ok(offRosterNote);
    assert.equal(offRosterNote.severity, "info");
    assert.equal(offRosterNote.characterId, "marcus");
  });

  it("reports info notes for unused characters and backgrounds", () => {
    const comic = createFullyConsistentComic();
    // panel does not use marcus or neon-alley
    comic.pages[0].panels[0].scene = {
      characterIds: ["elena"],
      action: "Elena standing in empty room",
    };
    comic.pages[0].panels[0].bubbles = [];

    const report = checkContinuity(comic);
    const unusedChar = report.issues.find(
      (i) => i.type === "unused-character" && i.characterId === "marcus",
    );
    const unusedBg = report.issues.find(
      (i) => i.type === "unused-background" && i.backgroundId === "neon-alley",
    );

    assert.ok(unusedChar);
    assert.equal(unusedChar.severity, "info");
    assert.ok(unusedBg);
    assert.equal(unusedBg.severity, "info");
  });
});

describe("Story Bible Cascading Deletion Helpers", () => {
  it("deleteCharacterFromComic cleanly removes character, panel roster, outfits, and bubble speakers", () => {
    const comic = createFullyConsistentComic();
    assert.ok(comic.assetContext?.characters?.elena);
    assert.ok(comic.pages[0].panels[0].scene?.characterIds?.includes("elena"));
    assert.equal(comic.pages[0].panels[0].bubbles[0].speakerId, "elena");
    assert.equal(comic.pages[0].panels[0].scene?.outfitByCharacter?.elena, "detective-coat");

    const updated = deleteCharacterFromComic(comic, "elena");

    assert.equal(updated.assetContext?.characters?.elena, undefined);
    assert.ok(!updated.pages[0].panels[0].scene?.characterIds?.includes("elena"));
    assert.equal(updated.pages[0].panels[0].scene?.outfitByCharacter?.elena, undefined);
    assert.equal(updated.pages[0].panels[0].bubbles[0].speakerId, undefined);
    // marcus still retained
    assert.ok(updated.assetContext?.characters?.marcus);
    assert.ok(updated.pages[0].panels[0].scene?.characterIds?.includes("marcus"));
  });

  it("deleteBackgroundFromComic cleanly removes background and clears panel scenes referencing it", () => {
    const comic = createFullyConsistentComic();
    assert.ok(comic.assetContext?.backgrounds?.["neon-alley"]);
    assert.equal(comic.pages[0].panels[0].scene?.backgroundId, "neon-alley");

    const updated = deleteBackgroundFromComic(comic, "neon-alley");

    assert.equal(updated.assetContext?.backgrounds?.["neon-alley"], undefined);
    assert.equal(updated.pages[0].panels[0].scene?.backgroundId, undefined);
    // characters remain untouched
    assert.ok(updated.assetContext?.characters?.elena);
    assert.ok(updated.pages[0].panels[0].scene?.characterIds?.includes("elena"));
  });

  it("deleteBackgroundFromComic clears scene to undefined if background was the only scene property", () => {
    const comic = createComic("Test Comic", "Test Author");
    comic.assetContext = {
      backgrounds: {
        alley: { id: "alley", name: "Alley", description: "Dark alley" },
      },
    };
    const p = createPage("splash");
    p.panels[0].scene = { backgroundId: "alley" };
    comic.pages = [p];

    const updated = deleteBackgroundFromComic(comic, "alley");
    assert.equal(updated.pages[0].panels[0].scene, undefined);
  });
});

describe("Demo Comic & Outfit Continuity Audits", () => {
  it("createDemoComic passes continuity audit with zero errors, zero warnings, and 100% panel coverage", () => {
    const demo = createDemoComic();
    const report = checkContinuity(demo);

    assert.equal(report.passed, true);
    assert.equal(report.issueCount.errors, 0);
    assert.equal(report.issueCount.warnings, 0);
    assert.equal(report.issueCount.infos, 0);
    assert.equal(report.stats.totalPages, 7);
    assert.equal(report.stats.totalPanels, 7);
    assert.equal(report.stats.panelsWithScene, 7);
    assert.equal(report.stats.panelsWithImage, 7);
    assert.equal(report.stats.totalCharacters, 1);
    assert.equal(report.stats.usedCharacters, 1);
    assert.equal(report.stats.totalBackgrounds, 2);
    assert.equal(report.stats.usedBackgrounds, 2);
  });

  it("flags error when scene outfit references unknown character and warning for unknown outfit on character", () => {
    const comic = createFullyConsistentComic();
    comic.assetContext!.characters!.elena.outfits = [
      { id: "detective-coat", label: "Detective Coat", description: "Dark trench coat" },
    ];

    // Reference unknown character in outfitByCharacter
    comic.pages[0].panels[0].scene!.outfitByCharacter = {
      ghost_agent: "stealth-suit",
    };
    let report = checkContinuity(comic);
    const missingCharOutfit = report.issues.find(
      (i) => i.id.includes("missing-outfit-char") && i.characterId === "ghost_agent",
    );
    assert.ok(missingCharOutfit);
    assert.equal(missingCharOutfit.severity, "error");

    // Reference unknown outfit for known character
    comic.pages[0].panels[0].scene!.outfitByCharacter = {
      elena: "ballroom-gown",
    };
    report = checkContinuity(comic);
    const unknownOutfit = report.issues.find(
      (i) => i.id.includes("unknown-outfit") && i.characterId === "elena",
    );
    assert.ok(unknownOutfit);
    assert.equal(unknownOutfit.severity, "warning");
  });
});
