import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { mergeComics } from "./sync.ts";
import { atomicWriteJsonSync, atomicWriteJson } from "./sync-node.ts";
import { createComic } from "./factory.ts";
import type { Comic } from "./types.ts";

describe("Two-way Sync mergeComics", () => {
  it("keeps comics present only on local side", () => {
    const local = [createComic("Local Only", "Author A")];
    const remote: Comic[] = [];

    const { merged, changed } = mergeComics(local, remote);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].title, "Local Only");
    assert.equal(changed, false);
  });

  it("adds comics present only on remote side", () => {
    const local: Comic[] = [];
    const remote = [createComic("Remote Only", "Author B")];

    const { merged, changed } = mergeComics(local, remote);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].title, "Remote Only");
    assert.equal(changed, true);
  });

  it("selects newer comic when remote has newer updatedAt", () => {
    const c1 = createComic("Comic 1", "Author C");
    c1.updatedAt = 1000;
    c1.title = "Local Old Title";

    const c1Remote = { ...c1, updatedAt: 2000, title: "Remote New Title" };

    const { merged, changed } = mergeComics([c1], [c1Remote]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].title, "Remote New Title");
    assert.equal(changed, true);
  });

  it("selects newer comic when local has newer updatedAt", () => {
    const c1 = createComic("Comic 1", "Author D");
    c1.updatedAt = 3000;
    c1.title = "Local Fresh Title";

    const c1Remote = { ...c1, updatedAt: 2000, title: "Remote Stale Title" };

    const { merged, changed } = mergeComics([c1], [c1Remote]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].title, "Local Fresh Title");
    assert.equal(changed, false);
  });

  it("excludes comics listed in deletedIds from either side", () => {
    const c1 = createComic("To Be Deleted", "Author E");
    const c2 = createComic("Surviving Comic", "Author F");

    const local = [c1, c2];
    const remote = [c1];

    const { merged } = mergeComics(local, remote, [c1.id]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].id, c2.id);
  });
});

describe("Atomic JSON Writes", () => {
  it("writes valid json atomically without leaving temp files", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "inkframe-test-"));
    const targetFile = path.join(tmpDir, "comics.json");

    try {
      atomicWriteJsonSync(targetFile, [{ hello: "world" }]);
      assert.ok(fs.existsSync(targetFile));
      const readSync = JSON.parse(fs.readFileSync(targetFile, "utf-8"));
      assert.deepEqual(readSync, [{ hello: "world" }]);

      await atomicWriteJson(targetFile, [{ hello: "async" }]);
      const readAsync = JSON.parse(fs.readFileSync(targetFile, "utf-8"));
      assert.deepEqual(readAsync, [{ hello: "async" }]);

      // Verify no leftover .tmp files
      const files = fs.readdirSync(tmpDir);
      assert.deepEqual(files, ["comics.json"]);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
