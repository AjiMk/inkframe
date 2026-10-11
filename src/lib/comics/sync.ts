import type { Comic } from "./types.ts";

export interface MergeResult {
  merged: Comic[];
  changed: boolean;
}

/**
 * Merges two collections of comics per-comic by ID:
 * - Omits any comic whose ID is present in `deletedIds`.
 * - If a comic exists only in `local` or only in `remote`, it is retained.
 * - If a comic exists in both:
 *     - If `remote.updatedAt > local.updatedAt`, `remote` wins.
 *     - If `local.updatedAt > remote.updatedAt`, `local` wins.
 *     - If timestamps are equal or absent:
 *       If JSON serializations differ, `remote` is chosen deterministically.
 * - Returns the merged list and a boolean `changed` indicating whether the
 *   merged result differs from `local`.
 */
export function mergeComics(
  local: Comic[],
  remote: Comic[],
  deletedIds?: Iterable<string>,
): MergeResult {
  const deleted = new Set(deletedIds ?? []);
  const localMap = new Map<string, Comic>();
  for (const c of local) {
    if (!deleted.has(c.id)) localMap.set(c.id, c);
  }

  const remoteMap = new Map<string, Comic>();
  for (const c of remote) {
    if (!deleted.has(c.id)) remoteMap.set(c.id, c);
  }

  const mergedMap = new Map<string, Comic>();

  // Start with all valid remote comics
  for (const [id, rComic] of remoteMap.entries()) {
    const lComic = localMap.get(id);
    if (!lComic) {
      mergedMap.set(id, rComic);
      continue;
    }
    const rTime = rComic.updatedAt ?? 0;
    const lTime = lComic.updatedAt ?? 0;
    if (rTime > lTime) {
      mergedMap.set(id, rComic);
    } else if (lTime > rTime) {
      mergedMap.set(id, lComic);
    } else {
      // Equal timestamps: prefer remote if content differs
      mergedMap.set(id, rComic);
    }
  }

  // Add any local comics not present in remote
  for (const [id, lComic] of localMap.entries()) {
    if (!mergedMap.has(id)) {
      mergedMap.set(id, lComic);
    }
  }

  const merged = Array.from(mergedMap.values());

  // Check if merged differs from local
  let changed = false;
  if (merged.length !== local.length) {
    changed = true;
  } else {
    for (let i = 0; i < merged.length; i++) {
      if (merged[i].id !== local[i]?.id || JSON.stringify(merged[i]) !== JSON.stringify(local[i])) {
        changed = true;
        break;
      }
    }
  }

  return { merged, changed };
}
