import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { useComicStore, getComicMediaRefs, collectAllReferencedMedia } from "./store.ts";
import { createComic, changePageLayoutPreservingImages } from "./factory.ts";
import { slugifyReferenceName, makeReferenceId } from "./references.ts";
import { selectOrphanMediaIds, RECENT_UPLOAD_GRACE_MS, isAssetRef, assetSrc } from "./media.ts";
import type { CharacterReference, BackgroundReference } from "./types.ts";

describe("Reference Slug & ID Generation", () => {
  it("slugifies simple and accented names into clean ASCII slugs", () => {
    assert.equal(slugifyReferenceName("Elena Vance"), "elena-vance");
    assert.equal(slugifyReferenceName("René Descartes"), "rene-descartes");
    assert.equal(slugifyReferenceName("  Cyber-Punk  Alley #9  "), "cyber-punk-alley-9");
    assert.equal(slugifyReferenceName("!!!"), "");
  });

  it("allocates base slug when ID is free", () => {
    const existing = new Set(["marcus", "sarah"]);
    assert.equal(makeReferenceId("Elena Vance", existing), "elena-vance");
  });

  it("increments numeric suffix when base slug collides", () => {
    const existing = new Set(["elena", "elena-2"]);
    assert.equal(makeReferenceId("Elena", existing), "elena-3");
  });

  it("falls back to 'ref' or 'ref-N' when name has no ASCII characters", () => {
    assert.equal(makeReferenceId("ആനന്ദ്", new Set()), "ref");
    assert.equal(makeReferenceId("ആനന്ദ്", new Set(["ref"])), "ref-2");
  });
});

describe("Orphan Media Selection & Retention", () => {
  it("filters out stored media that are active or in grace period", () => {
    const stored = ["media-1", "media-2", "media-3", "media-4"];
    const referenced = ["idb:media-1", "idb:media-2"];
    const now = 1_000_000;

    const uploads = new Map<string, number>([
      ["media-3", now - (RECENT_UPLOAD_GRACE_MS - 5000)], // inside grace period
      ["media-4", now - (RECENT_UPLOAD_GRACE_MS + 5000)], // expired
    ]);

    const orphans = selectOrphanMediaIds(stored, referenced, uploads, now);
    assert.deepEqual(orphans, ["media-4"]);
  });

  it("marks unreferenced media with no recent upload timestamp as orphans", () => {
    const stored = ["stale-1", "active-1"];
    const referenced = ["idb:active-1"];
    const uploads = new Map<string, number>();

    const orphans = selectOrphanMediaIds(stored, referenced, uploads);
    assert.deepEqual(orphans, ["stale-1"]);
  });

  it("recognizes asset: scheme and preserves active assets from orphan list", () => {
    assert.equal(isAssetRef("asset:portrait-123"), true);
    assert.equal(isAssetRef("idb:portrait-123"), false);
    assert.equal(assetSrc("asset:portrait-123"), "/__inkframe/assets/portrait-123");

    const stored = ["asset-kept", "orphan-del"];
    const referenced = ["asset:asset-kept"];
    const uploads = new Map<string, number>();

    const orphans = selectOrphanMediaIds(stored, referenced, uploads);
    assert.deepEqual(orphans, ["orphan-del"]);
  });
});

describe("Story Bible & Continuity Manager Store Actions", () => {
  it("initializes demo or created comic with assetContext", () => {
    const comic = createComic("Test Comic", "Author X");
    assert.ok(comic.assetContext);
    assert.equal(typeof comic.assetContext?.styleGuide, "string");
  });

  it("updates master art style guide via updateAssetContext", () => {
    const store = useComicStore.getState();
    const comicId = store.create("Continuity Test", "Author Y");

    store.updateAssetContext(comicId, {
      styleGuide: "Noir graphic novel ink wash with heavy cross-hatching",
    });

    const updated = useComicStore.getState().comics.find((c) => c.id === comicId);
    assert.equal(
      updated?.assetContext?.styleGuide,
      "Noir graphic novel ink wash with heavy cross-hatching",
    );
  });

  it("upserts and deletes character model sheets", () => {
    const store = useComicStore.getState();
    const comicId = store.create("Character Test", "Author Z");

    const char1: CharacterReference = {
      id: "detective_vance",
      name: "Detective Vance",
      role: "Lead Investigator",
      appearance: "Late 30s, charcoal trench coat, disheveled hair",
      imageRef: "idb:portrait_123",
    };

    store.upsertCharacter(comicId, char1);

    let comic = useComicStore.getState().comics.find((c) => c.id === comicId);
    assert.ok(comic?.assetContext?.characters?.["detective_vance"]);
    assert.equal(comic?.assetContext?.characters?.["detective_vance"].name, "Detective Vance");
    assert.equal(comic?.assetContext?.characters?.["detective_vance"].role, "Lead Investigator");

    // Update character
    const char1Updated: CharacterReference = {
      ...char1,
      appearance: "Late 30s, charcoal trench coat with brass buttons",
    };
    store.upsertCharacter(comicId, char1Updated);

    comic = useComicStore.getState().comics.find((c) => c.id === comicId);
    assert.equal(
      comic?.assetContext?.characters?.["detective_vance"].appearance,
      "Late 30s, charcoal trench coat with brass buttons",
    );

    // Delete character
    store.deleteCharacter(comicId, "detective_vance");
    comic = useComicStore.getState().comics.find((c) => c.id === comicId);
    assert.equal(comic?.assetContext?.characters?.["detective_vance"], undefined);
  });

  it("upserts and deletes background references", () => {
    const store = useComicStore.getState();
    const comicId = store.create("Location Test", "Author W");

    const bg1: BackgroundReference = {
      id: "neon_alley",
      name: "Neon Alley",
      description: "Damp brick alleyway with magenta neon signage and steam",
      imageRef: "idb:bg_456",
    };

    store.upsertBackground(comicId, bg1);

    let comic = useComicStore.getState().comics.find((c) => c.id === comicId);
    assert.ok(comic?.assetContext?.backgrounds?.["neon_alley"]);
    assert.equal(comic?.assetContext?.backgrounds?.["neon_alley"].name, "Neon Alley");

    // Delete background
    store.deleteBackground(comicId, "neon_alley");
    comic = useComicStore.getState().comics.find((c) => c.id === comicId);
    assert.equal(comic?.assetContext?.backgrounds?.["neon_alley"], undefined);
  });

  it("gathers character and background media refs in getComicMediaRefs", () => {
    const store = useComicStore.getState();
    const comicId = store.create("Media Gathering Test", "Author M");

    store.upsertCharacter(comicId, {
      id: "hero",
      name: "Hero",
      appearance: "Hero outfit",
      imageRef: "idb:hero_avatar",
    });

    store.upsertBackground(comicId, {
      id: "hq",
      name: "Secret HQ",
      description: "Underground bunker",
      imageRef: "idb:hq_backdrop",
    });

    store.upsertCharacter(comicId, {
      id: "multi_hero",
      name: "Multi Hero",
      appearance: "Multi appearance",
      imageRef: "idb:hero_avatar_1",
      imageRefs: ["idb:hero_avatar_1", "idb:hero_avatar_2", "idb:hero_avatar_3"],
    });

    const comic = useComicStore.getState().comics.find((c) => c.id === comicId)!;
    const mediaRefs = getComicMediaRefs(comic);

    assert.ok(mediaRefs.includes("idb:hero_avatar"));
    assert.ok(mediaRefs.includes("idb:hero_avatar_1"));
    assert.ok(mediaRefs.includes("idb:hero_avatar_2"));
    assert.ok(mediaRefs.includes("idb:hero_avatar_3"));
    assert.ok(mediaRefs.includes("idb:hq_backdrop"));
  });

  it("preserves deleted media in collectAllReferencedMedia if stored in undo history", () => {
    const store = useComicStore.getState();
    const comicId = store.create("Undo Preservation Test", "Author U");

    store.upsertCharacter(comicId, {
      id: "temp_char",
      name: "Temporary Char",
      appearance: "Visible initially",
      imageRef: "idb:temp_portrait_789",
    });

    // Delete character - comic state no longer has it, but past state does
    store.deleteCharacter(comicId, "temp_char");

    const state = useComicStore.getState();
    const currentComic = state.comics.find((c) => c.id === comicId)!;
    const currentRefs = getComicMediaRefs(currentComic);
    assert.equal(currentRefs.includes("idb:temp_portrait_789"), false);

    const allPreserved = collectAllReferencedMedia(state);
    assert.ok(
      allPreserved.has("idb:temp_portrait_789"),
      "Media referenced in undo stack must be preserved from pruning",
    );
  });

  it("attaches scene continuity metadata to a panel via setPanelScene", () => {
    const store = useComicStore.getState();
    const comicId = store.create("Scene Test", "Author S");
    const comic = useComicStore.getState().comics.find((c) => c.id === comicId)!;
    const pageId = comic.pages[0].id;
    const panelId = comic.pages[0].panels[0].id;

    store.setPanelScene(comicId, pageId, panelId, {
      characterIds: ["char_1", "char_2"],
      backgroundId: "bg_1",
      shot: "close-up",
      action: "Elena whispers a secret to Marcus",
    });

    const updated = useComicStore.getState().comics.find((c) => c.id === comicId)!;
    const panel = updated.pages[0].panels.find((p) => p.id === panelId)!;
    assert.deepEqual(panel.scene?.characterIds, ["char_1", "char_2"]);
    assert.equal(panel.scene?.backgroundId, "bg_1");
    assert.equal(panel.scene?.shot, "close-up");
    assert.equal(panel.scene?.action, "Elena whispers a secret to Marcus");

    // Clear scene with null
    store.setPanelScene(comicId, pageId, panelId, null);
    const cleared = useComicStore.getState().comics.find((c) => c.id === comicId)!;
    const clearedPanel = cleared.pages[0].panels.find((p) => p.id === panelId)!;
    assert.equal(clearedPanel.scene, undefined);
  });

  it("cascades character and background deletions to linked panel scenes", () => {
    const store = useComicStore.getState();
    const comicId = store.create("Cascade Test", "Author C");

    store.upsertCharacter(comicId, {
      id: "elena",
      name: "Elena",
      appearance: "Cyber punk",
    });
    store.upsertCharacter(comicId, {
      id: "marcus",
      name: "Marcus",
      appearance: "Android companion",
    });
    store.upsertBackground(comicId, {
      id: "cyber_docks",
      name: "Cyber Docks",
      description: "Neon lit shipping dock",
    });

    const comic = useComicStore.getState().comics.find((c) => c.id === comicId)!;
    const pageId = comic.pages[0].id;
    const panelId = comic.pages[0].panels[0].id;

    store.setPanelScene(comicId, pageId, panelId, {
      characterIds: ["elena", "marcus"],
      backgroundId: "cyber_docks",
      shot: "wide",
      action: "Meeting at the docks",
    });

    // Delete Elena -> panel.scene.characterIds should now only contain marcus
    store.deleteCharacter(comicId, "elena");
    let updated = useComicStore.getState().comics.find((c) => c.id === comicId)!;
    let panel = updated.pages[0].panels.find((p) => p.id === panelId)!;
    assert.deepEqual(panel.scene?.characterIds, ["marcus"]);
    assert.equal(panel.scene?.backgroundId, "cyber_docks");

    // Delete Cyber Docks -> panel.scene.backgroundId should be undefined
    store.deleteBackground(comicId, "cyber_docks");
    updated = useComicStore.getState().comics.find((c) => c.id === comicId)!;
    panel = updated.pages[0].panels.find((p) => p.id === panelId)!;
    assert.equal(panel.scene?.backgroundId, undefined);
    assert.deepEqual(panel.scene?.characterIds, ["marcus"]);
  });

  it("preserves panels with active scene metadata during page layout changes", () => {
    const comic = createComic("Layout Scene Test", "Author L");
    const page = comic.pages[0];
    page.panels[0].scene = {
      action: "Important storyline event",
      shot: "establishing",
    };

    // Switch layout from multi-panel to splash (1 panel) - panel 0 must be kept
    const updated = changePageLayoutPreservingImages(comic, page.id, "splash");
    assert.equal(updated.pages[0].panels.length, 1);
    assert.equal(updated.pages[0].panels[0].scene?.action, "Important storyline event");
  });

  it("stores and retrieves structured character sheets with traits, palette, invariants, and voice", () => {
    const store = useComicStore.getState();
    const comicId = store.create("Structured Sheet Test", "Author T");

    const fullChar: CharacterReference = {
      id: "elena_vance",
      name: "Elena Vance",
      role: "Lead Operative",
      appearance: "Late 20s cyber investigator",
      aliases: ["Vance", "The Courier"],
      traits: {
        face: "Sharp cheekbones, subtle lip scar",
        hair: "Asymmetrical silver-streaked bob",
        build: "Athletic runner",
        age: "28",
      },
      signatureOutfit: "Charcoal trench with high collar and neon lining",
      palette: ["#0f172a", "#38bdf8", "#f43f5e"],
      invariants: [
        "Right eye is a cyan cybernetic optic",
        "Never parts with antique brass chronometer",
      ],
      outfits: [
        {
          id: "stealth",
          label: "Stealth Suit",
          description: "Matte black compression gear",
        },
      ],
      voice: "Dry, clipped, uses deadpan humor, avoids slang",
    };

    store.upsertCharacter(comicId, fullChar);

    const saved = useComicStore.getState().comics.find((c) => c.id === comicId)!;
    const retrieved = saved.assetContext?.characters?.["elena_vance"];
    assert.ok(retrieved);
    assert.deepEqual(retrieved.aliases, ["Vance", "The Courier"]);
    assert.equal(retrieved.traits?.hair, "Asymmetrical silver-streaked bob");
    assert.deepEqual(retrieved.palette, ["#0f172a", "#38bdf8", "#f43f5e"]);
    assert.equal(retrieved.invariants?.length, 2);
    assert.equal(retrieved.voice, "Dry, clipped, uses deadpan humor, avoids slang");
  });

  it("links speech bubbles to character speakers and clears speakerId on character deletion", () => {
    const store = useComicStore.getState();
    const comicId = store.create("Dialogue Link Test", "Author D");

    store.upsertCharacter(comicId, {
      id: "dr_marcus",
      name: "Dr. Marcus",
      appearance: "Elderly cybernetics engineer",
    });

    const comic = useComicStore.getState().comics.find((c) => c.id === comicId)!;
    const pageId = comic.pages[0].id;
    const panelId = comic.pages[0].panels[0].id;

    const bubbleId = store.addBubble(comicId, pageId, panelId, "speech");
    store.updateBubble(comicId, pageId, panelId, bubbleId, {
      text: "The telemetry doesn't lie.",
      speakerId: "dr_marcus",
    });

    let updated = useComicStore.getState().comics.find((c) => c.id === comicId)!;
    let b = updated.pages[0].panels[0].bubbles.find((item) => item.id === bubbleId)!;
    assert.equal(b.speakerId, "dr_marcus");

    // Deleting Dr. Marcus should cascade and clear speakerId on the bubble
    store.deleteCharacter(comicId, "dr_marcus");

    updated = useComicStore.getState().comics.find((c) => c.id === comicId)!;
    b = updated.pages[0].panels[0].bubbles.find((item) => item.id === bubbleId)!;
    assert.equal(b.speakerId, undefined);
  });

  it("persists outfitByCharacter in panel scene metadata", () => {
    const store = useComicStore.getState();
    const comicId = store.create("Panel Outfit Test", "Author O");
    const comic = useComicStore.getState().comics.find((c) => c.id === comicId)!;
    const pageId = comic.pages[0].id;
    const panelId = comic.pages[0].panels[0].id;

    store.setPanelScene(comicId, pageId, panelId, {
      characterIds: ["char_a"],
      outfitByCharacter: { char_a: "stealth_suit" },
    });

    const updated = useComicStore.getState().comics.find((c) => c.id === comicId)!;
    const panel = updated.pages[0].panels.find((p) => p.id === panelId)!;
    assert.equal(panel.scene?.outfitByCharacter?.["char_a"], "stealth_suit");
  });
});
