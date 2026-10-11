import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { useComicStore, getComicMediaRefs } from "./store.ts";
import { createComic } from "./factory.ts";
import type { CharacterReference, BackgroundReference } from "./types.ts";

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
});
