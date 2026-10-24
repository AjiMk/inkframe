import fs from "node:fs";
import path from "node:path";
import { importStoryboard } from "../src/lib/comics/story-importer.ts";
import { readComicsFromDisk, atomicWriteJsonSync, DEFAULT_STORAGE_PATH } from "../src/lib/comics/sync-node.ts";
import { checkContinuity } from "../src/lib/comics/continuity.ts";

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {
    story: "",
    frames: "",
    comicId: "",
    title: "",
    author: "",
    storage: DEFAULT_STORAGE_PATH,
    copyAssets: true,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--story") params.story = args[++i];
    else if (arg === "--frames") params.frames = args[++i];
    else if (arg === "--comic-id") params.comicId = args[++i];
    else if (arg === "--title") params.title = args[++i];
    else if (arg === "--author") params.author = args[++i];
    else if (arg === "--storage") params.storage = path.resolve(args[++i]);
    else if (arg === "--no-copy") params.copyAssets = false;
  }
  return params;
}

const params = parseArgs();
if (!params.story) {
  console.error("Error: --story path required");
  process.exit(1);
}

const storyRaw = fs.readFileSync(path.resolve(params.story), "utf-8");
const story = JSON.parse(storyRaw);

const rawId = params.comicId || (params.title ? params.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "") || "the-secret-watch";
const comicId = rawId.startsWith("comic-") ? rawId : `comic-${rawId}`;

const targetDir = params.storage
  ? path.resolve(path.dirname(params.storage), "comics", comicId)
  : undefined;

const result = importStoryboard(story, {
  comicId,
  title: params.title || undefined,
  author: params.author || undefined,
  framesDir: params.frames ? path.resolve(params.frames) : undefined,
  copyAssets: params.copyAssets,
  targetDir,
});

const comics = readComicsFromDisk(params.storage);
const idx = comics.findIndex((c) => c.id === result.comic.id);
if (idx >= 0) {
  comics[idx] = result.comic;
} else {
  comics.unshift(result.comic);
}

atomicWriteJsonSync(params.storage, comics);

const audit = checkContinuity(result.comic);
const errors = audit.issues.filter((i) => i.severity === "error").map((i) => i.message);

const output = {
  success: true,
  comicId: result.comic.id,
  comicTitle: result.comic.title,
  pagesCount: result.pagesCount,
  panelsCount: result.panelsCount,
  imagesAssignedCount: result.imagesAssignedCount,
  copiedAssetsCount: result.copiedAssetsCount,
  continuityErrors: errors,
};

console.log(JSON.stringify(output));
