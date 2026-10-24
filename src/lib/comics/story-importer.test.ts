import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  importStoryboard,
  mapCameraShot,
  partitionShotsIntoLayouts,
  type Storyboard,
} from "./story-importer.ts";
import { checkContinuity } from "./continuity.ts";

test("mapCameraShot framing helper", () => {
  assert.equal(mapCameraShot("wide", "eye-level"), "wide");
  assert.equal(mapCameraShot("wide", "table-height low"), "low-angle");
  assert.equal(mapCameraShot("close-up", "high"), "high-angle");
  assert.equal(mapCameraShot("close-up", "eye-level"), "close-up");
  assert.equal(mapCameraShot("extreme-close-up", "eye-level"), "extreme-close-up");
  assert.equal(mapCameraShot("medium", "eye-level", "over-shoulder"), "over-shoulder");
});

test("partitionShotsIntoLayouts for widescreen stills", () => {
  assert.deepEqual(partitionShotsIntoLayouts(1), ["splash"]);
  assert.deepEqual(partitionShotsIntoLayouts(2), ["two-v"]);
  assert.deepEqual(partitionShotsIntoLayouts(3), ["three-strip"]);
  assert.deepEqual(partitionShotsIntoLayouts(4), ["two-v", "two-v"]);
  assert.deepEqual(partitionShotsIntoLayouts(5), ["two-v", "three-strip"]);
  assert.deepEqual(partitionShotsIntoLayouts(6), ["three-strip", "three-strip"]);
});

test("importStoryboard builds valid comic passing continuity check with zero errors", () => {
  const sampleStory: Storyboard = {
    language: "English",
    facts: ["Ajay and Kavya work in IT.", "The secret watch can pause time."],
    characters: [
      {
        name: "Ajay",
        role: "Introverted IT employee",
        speech: "Quiet and careful",
        cannot_say: "Cannot say he paused time",
        garments: [{ stretch: "day", garment: "Grey office shirt, navy trousers" }],
      },
      {
        name: "Kavya",
        role: "IT colleague",
        speech: "Brisk and professional",
        hide: "Secret relationship",
        garments: [{ stretch: "day", garment: "White blouse, black trousers" }],
      },
    ],
    scenes: [
      {
        id: "scene-1",
        place: "Kavya's bay",
        time_of_day: "Late morning",
        lines: [
          { speaker: "Kavya", spoken: "Park the notes, Ajay.", thought: "Need him to leave." },
          { speaker: "Ajay", spoken: "I'll close the tickets.", thought: "Only excuse to stay." },
        ],
      },
    ],
    shots: [
      {
        scene_id: "scene-1",
        order: 0,
        beat: "Kavya at desk while Ajay stands nearby",
        size: "wide",
        in_frame: ["Ajay", "Kavya"],
        line_index: 0,
      },
      {
        scene_id: "scene-1",
        order: 1,
        beat: "Ajay answers quietly",
        size: "medium",
        in_frame: ["Ajay"],
        line_index: 1,
      },
    ],
  };

  const result = importStoryboard(sampleStory, {
    title: "Test Storyboard",
    author: "Test Author",
  });

  const comic = result.comic;
  assert.equal(comic.title, "Test Storyboard");
  assert.equal(comic.author, "Test Author");
  assert.equal(comic.pages.length, 1);
  assert.equal(comic.pages[0].layout, "two-v");
  assert.equal(comic.pages[0].panels.length, 2);

  // Character references in Story Bible
  assert.ok(comic.assetContext?.characters?.["ajay"]);
  assert.ok(comic.assetContext?.characters?.["kavya"]);

  // Speech & Thought bubbles
  const panel0 = comic.pages[0].panels[0];
  assert.ok(panel0.bubbles.length >= 2); // Title banner + speech + thought
  const speechBubble = panel0.bubbles.find((b) => b.kind === "speech");
  assert.equal(speechBubble?.text, "Park the notes, Ajay.");
  assert.equal(speechBubble?.speakerId, "kavya");

  // Continuity check
  const report = checkContinuity(comic);
  assert.equal(report.issueCount.errors, 0, `Continuity errors found: ${JSON.stringify(report.issues.filter(i => i.severity === 'error'))}`);
});

test("importStoryboard copies frame files when framesDir is provided", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "inkframe-test-"));
  const framesDir = path.join(tmpDir, "frames");
  const targetDir = path.join(tmpDir, "public", "comics", "comic-test-watch");
  fs.mkdirSync(framesDir, { recursive: true });

  fs.writeFileSync(path.join(framesDir, "scene-1-shot-01.jpg"), "fake-jpg-1");
  fs.writeFileSync(path.join(framesDir, "scene-1-shot-02.jpg"), "fake-jpg-2");

  const story: Storyboard = {
    characters: [{ name: "Ajay", role: "Protagonist" }],
    scenes: [{ id: "scene-1", place: "Office" }],
    shots: [
      { scene_id: "scene-1", order: 0, beat: "Establishing office" },
      { scene_id: "scene-1", order: 1, beat: "Ajay at desk" },
    ],
  };

  const result = importStoryboard(story, {
    comicId: "test-watch",
    framesDir,
    targetDir,
    copyAssets: true,
  });

  assert.equal(result.imagesAssignedCount, 2);
  assert.equal(result.copiedAssetsCount, 2);
  assert.ok(fs.existsSync(path.join(targetDir, "scene-1-shot-01.jpg")));
  assert.ok(fs.existsSync(path.join(targetDir, "scene-1-shot-02.jpg")));
  assert.equal(result.comic.pages[0].panels[0].image, "url:/comics/comic-test-watch/scene-1-shot-01.jpg");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
