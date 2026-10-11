/**
 * Helpers for Story Bible reference entries (characters and locations).
 * Kept free of React and browser APIs so both the UI and tests can use them.
 */

/** Turns a display name into a lowercase ASCII slug, e.g. "Elena Vance" -> "elena-vance". */
export function slugifyReferenceName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Builds a new, unique reference ID from a name.
 *
 * Uses the slug when it is free, otherwise appends "-2", "-3", ... so that two
 * characters with the same name never overwrite each other. Names with no
 * ASCII letters (for example Malayalam names) fall back to "ref".
 */
export function makeReferenceId(name: string, existingIds: Iterable<string>): string {
  const taken = new Set(existingIds);
  const base = slugifyReferenceName(name) || "ref";
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
