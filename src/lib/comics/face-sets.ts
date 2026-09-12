import { create } from "zustand";
import { deleteMediaRef } from "./media";
import type { FaceSet, FaceSetFace } from "./types";
import { nid } from "@/lib/utils";

const KEY = "inkframe.faceSets.v1";

function readSets(): FaceSet[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FaceSet[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSets(sets: FaceSet[]) {
  localStorage.setItem(KEY, JSON.stringify(sets));
}

interface FaceSetState {
  sets: FaceSet[];
  hydrated: boolean;
  hydrate: () => void;
  createSet: (name: string, sourcePhoto: string | null, faces: FaceSetFace[]) => FaceSet;
  addFaces: (setId: string, faces: FaceSetFace[]) => void;
  renameSet: (setId: string, name: string) => void;
  renameFace: (setId: string, faceId: string, name: string) => void;
  removeFace: (setId: string, faceId: string) => void;
  removeSet: (setId: string) => void;
}

export const useFaceSetStore = create<FaceSetState>((set, get) => ({
  sets: [],
  hydrated: false,

  hydrate: () => {
    if (get().hydrated || typeof window === "undefined") return;
    set({ sets: readSets(), hydrated: true });
  },

  createSet: (name, sourcePhoto, faces) => {
    const next: FaceSet = {
      id: nid(),
      name: name.trim() || "Face set",
      sourcePhoto,
      faces,
      createdAt: Date.now(),
    };
    const sets = [next, ...get().sets];
    writeSets(sets);
    set({ sets });
    return next;
  },

  addFaces: (setId, faces) => {
    const sets = get().sets.map((item) =>
      item.id === setId ? { ...item, faces: [...item.faces, ...faces] } : item,
    );
    writeSets(sets);
    set({ sets });
  },

  renameSet: (setId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const sets = get().sets.map((item) => (item.id === setId ? { ...item, name: trimmed } : item));
    writeSets(sets);
    set({ sets });
  },

  renameFace: (setId, faceId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const sets = get().sets.map((item) =>
      item.id === setId
        ? {
            ...item,
            faces: item.faces.map((face) =>
              face.id === faceId ? { ...face, name: trimmed } : face,
            ),
          }
        : item,
    );
    writeSets(sets);
    set({ sets });
  },

  removeFace: (setId, faceId) => {
    const target = get().sets.find((item) => item.id === setId);
    const face = target?.faces.find((item) => item.id === faceId);
    if (face) void deleteMediaRef(face.src);
    const sets = get()
      .sets.map((item) =>
        item.id === setId
          ? { ...item, faces: item.faces.filter((entry) => entry.id !== faceId) }
          : item,
      )
      .filter((item) => item.faces.length > 0 || item.sourcePhoto);
    writeSets(sets);
    set({ sets });
  },

  removeSet: (setId) => {
    const target = get().sets.find((item) => item.id === setId);
    if (target) {
      void deleteMediaRef(target.sourcePhoto);
      for (const face of target.faces) void deleteMediaRef(face.src);
    }
    const sets = get().sets.filter((item) => item.id !== setId);
    writeSets(sets);
    set({ sets });
  },
}));

export function allFacesFromSets(sets: FaceSet[]): FaceSetFace[] {
  return sets.flatMap((item) => item.faces);
}
