import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { useComicStore, getComicMediaRefs, collectAllReferencedMedia } from "./store.ts";
import { createComic } from "./factory.ts";
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

    const comic = useComicStore.getState().comics.find((c) => c.id === comicId)!;
    const mediaRefs = getComicMediaRefs(comic);

    assert.ok(mediaRefs.includes("idb:hero_avatar"));
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
});
