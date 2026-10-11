import { useEffect, useState } from "react";
import { nid } from "../utils.ts";

const DB_NAME = "inkframe";
const STORE = "media";

/**
 * Uploads made during this session, keyed by IndexedDB id with their creation
 * time. Pruning skips recent uploads so an image that is attached in an open
 * form (but not yet saved to a comic) is never deleted underneath the user.
 */
const recentUploads = new Map<string, number>();
export const RECENT_UPLOAD_GRACE_MS = 10 * 60 * 1000;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("indexedDB is unavailable in this environment"));
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function isUrlRef(ref: string): boolean {
  return ref.startsWith("url:");
}

export function publicSrc(ref: string): string {
  return ref.slice(4);
}

export function isAssetRef(ref: string): boolean {
  return ref.startsWith("asset:");
}

export function assetSrc(ref: string): string {
  return `/__inkframe/assets/${ref.slice(6)}`;
}

export async function uploadAssetToDev(id: string, blob: Blob): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const res = await fetch(`/__inkframe/assets/${id}`, {
      method: "PUT",
      headers: { "Content-Type": blob.type || "image/webp" },
      body: blob,
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteDevAsset(id: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await fetch(`/__inkframe/assets/${id}`, { method: "DELETE" });
  } catch {
    // ignore
  }
}

/**
 * Puts reference media into IndexedDB (for reliable offline local storage)
 * and attempts uploading to the dev server to produce an `asset:` ref for MCP.
 */
export async function putReferenceMedia(blob: Blob): Promise<string> {
  const idbRef = await putMedia(blob);
  const id = idbRef.slice(4);
  const uploaded = await uploadAssetToDev(id, blob);
  if (uploaded) {
    return `asset:${id}`;
  }
  return idbRef;
}

export async function putMedia(blob: Blob): Promise<string> {
  const id = nid();
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  recentUploads.set(id, Date.now());
  return `idb:${id}`;
}

/** Lists every media id currently stored in IndexedDB. */
export async function listMediaIds(): Promise<string[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAllKeys();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return keys.map(String);
}

/**
 * Picks which stored media ids are safe to delete: not referenced by any
 * `idb:` ref and not uploaded within the grace period.
 */
export function selectOrphanMediaIds(
  storedIds: Iterable<string>,
  referencedRefs: Iterable<string>,
  uploadedAt: ReadonlyMap<string, number> = recentUploads,
  now: number = Date.now(),
  graceMs: number = RECENT_UPLOAD_GRACE_MS,
): string[] {
  const referenced = new Set<string>();
  for (const ref of referencedRefs) {
    if (ref.startsWith("idb:")) referenced.add(ref.slice(4));
    if (ref.startsWith("asset:")) referenced.add(ref.slice(6));
  }
  const orphans: string[] = [];
  for (const id of storedIds) {
    if (referenced.has(id)) continue;
    const created = uploadedAt.get(id);
    if (created !== undefined && now - created < graceMs) continue;
    orphans.push(id);
  }
  return orphans;
}

/** Deletes stored media that nothing references. Returns how many were removed. */
export async function pruneMedia(referencedRefs: Iterable<string>): Promise<number> {
  if (typeof indexedDB === "undefined") return 0;
  const orphans = selectOrphanMediaIds(await listMediaIds(), referencedRefs);
  for (const id of orphans) {
    await deleteMedia(id);
    recentUploads.delete(id);
  }
  return orphans.length;
}

export async function getMedia(id: string): Promise<Blob | null> {
  const db = await openDb();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return blob;
}

export async function deleteMedia(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function deleteMediaRef(ref: string | null): Promise<void> {
  if (!ref) return;
  if (ref.startsWith("asset:")) {
    const id = ref.slice(6);
    void deleteDevAsset(id);
    if (typeof indexedDB !== "undefined") {
      await deleteMedia(id);
    }
    return;
  }
  if (typeof indexedDB === "undefined" || !ref.startsWith("idb:")) return;
  await deleteMedia(ref.slice(4));
}

export async function resolveMediaUrl(ref: string): Promise<string> {
  if (isUrlRef(ref)) return publicSrc(ref);
  if (isAssetRef(ref)) return assetSrc(ref);
  if (!ref.startsWith("idb:")) return ref;
  const blob = await getMedia(ref.slice(4));
  if (!blob) throw new Error("Missing media");
  return URL.createObjectURL(blob);
}

export async function compressImage(
  source: Blob | HTMLVideoElement,
  maxSide = 1600,
  quality = 0.84,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");

  if (source instanceof HTMLVideoElement) {
    const w = source.videoWidth;
    const h = source.videoHeight;
    if (!w || !h) throw new Error("Video is not ready");
    const scale = Math.min(1, maxSide / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  } else {
    const bitmap = await createImageBitmap(source);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) throw new Error("Could not encode the frame");
  return blob;
}

export function useMediaUrl(ref: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (ref && isUrlRef(ref)) return publicSrc(ref);
    if (ref && isAssetRef(ref)) return assetSrc(ref);
    return null;
  });

  useEffect(() => {
    if (!ref) {
      setUrl(null);
      return;
    }
    if (isUrlRef(ref)) {
      setUrl(publicSrc(ref));
      return;
    }
    if (isAssetRef(ref)) {
      setUrl(assetSrc(ref));
      return;
    }
    if (!ref.startsWith("idb:")) {
      setUrl(ref);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    getMedia(ref.slice(4)).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [ref]);

  return url;
}
