import fs from "node:fs";
import path from "node:path";
import type { Comic } from "./types.ts";
import { createComic, defaultCoverConfig } from "./factory.ts";

/** Path to the shared comics JSON storage file. */
export const DEFAULT_STORAGE_PATH = path.resolve(process.cwd(), "public/mcp_comics.json");

/**
 * Synchronously writes data to disk by first writing to a unique temporary file
 * in the same directory and atomically renaming it into place.
 */
export function atomicWriteJsonSync(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(tmpPath, json, "utf-8");
  fs.renameSync(tmpPath, filePath);
}

/**
 * Asynchronously writes data to disk atomically using temporary file and rename.
 */
export async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  const json = JSON.stringify(data, null, 2);
  await fs.promises.writeFile(tmpPath, json, "utf-8");
  await fs.promises.rename(tmpPath, filePath);
}

/**
 * Reads the comics from the JSON file on disk. If missing or empty,
 * initializes with the default sample comic and writes it to disk.
 */
export function readComicsFromDisk(filePath: string = DEFAULT_STORAGE_PATH): Comic[] {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as Comic[];
      }
    }
  } catch (err) {
    console.error(`[inkframe-sync] Failed to read ${filePath}:`, err);
  }

  const sampleComic = createComic("Last One Out", "Inkframe Studio");
  sampleComic.coverConfig = {
    ...defaultCoverConfig(),
    template: "classic",
    titleStyle: "classic-3d",
    tagline: "A LATE-SHIFT HORROR",
    subtitle: "THE CRY WAS NOT A CHILD",
    titleColor: "#fef08a",
    accentColor: "#dc2626",
    issueNumber: "#1",
    issuePrice: "25¢",
  };
  const initial = [sampleComic];
  try {
    atomicWriteJsonSync(filePath, initial);
  } catch (err) {
    console.error(`[inkframe-sync] Failed to initialize ${filePath}:`, err);
  }
  return initial;
}
