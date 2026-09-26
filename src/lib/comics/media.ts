import { useEffect, useState } from "react";
import { nid } from "@/lib/utils";

const DB_NAME = "inkframe";
const STORE = "media";

function openDb(): Promise<IDBDatabase> {
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
  return `idb:${id}`;
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
  if (!ref?.startsWith("idb:")) return;
  await deleteMedia(ref.slice(4));
}

export async function resolveMediaUrl(ref: string): Promise<string> {
  if (isUrlRef(ref)) return publicSrc(ref);
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
