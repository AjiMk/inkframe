import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, ScanFace, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { FaceThumb } from "@/components/comic/face-thumb";
import { ImageStage, OvalMarks } from "@/components/comic/image-stage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFaceSetStore } from "@/lib/comics/face-sets";
import { cropFaceBlob, loadImageElement } from "@/lib/comics/faces";
import { compressImage, putMedia } from "@/lib/comics/media";
import type { FaceSetFace, NormBox } from "@/lib/comics/types";
import { nid } from "@/lib/utils";

interface Mark extends NormBox {
  id: string;
  name: string;
}

export function FaceSetBuilder({
  panelImageUrl,
  onCreated,
}: {
  panelImageUrl?: string | null;
  onCreated?: (faces: FaceSetFace[]) => void;
}) {
  const sets = useFaceSetStore((s) => s.sets);
  const hydrate = useFaceSetStore((s) => s.hydrate);
  const createSet = useFaceSetStore((s) => s.createSet);
  const addFaces = useFaceSetStore((s) => s.addFaces);
  const renameSet = useFaceSetStore((s) => s.renameSet);
  const renameFace = useFaceSetStore((s) => s.renameFace);
  const removeFace = useFaceSetStore((s) => s.removeFace);
  const removeSet = useFaceSetStore((s) => s.removeSet);

  const fileRef = useRef<HTMLInputElement>(null);
  const pendingEditRef = useRef<string | null>(null);
  const [mode, setMode] = useState<"library" | "mark">("library");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [ownedUrl, setOwnedUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [imgSize, setImgSize] = useState({ w: 1600, h: 900 });
  const [marks, setMarks] = useState<Mark[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [setName, setSetName] = useState("Cast");
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (mode !== "mark") return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if ((e.key === "Backspace" || e.key === "Delete") && selectedId) {
        e.preventDefault();
        setMarks((prev) => prev.filter((mark) => mark.id !== selectedId));
        setSelectedId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, selectedId]);

  useEffect(() => {
    return () => {
      if (ownedUrl) URL.revokeObjectURL(ownedUrl);
    };
  }, [ownedUrl]);

  const selectedMark = useMemo(
    () => marks.find((mark) => mark.id === selectedId) ?? null,
    [marks, selectedId],
  );

  function resetMarkSession() {
    if (ownedUrl) URL.revokeObjectURL(ownedUrl);
    setOwnedUrl(null);
    setPhotoUrl(null);
    setPhotoFile(null);
    setMarks([]);
    setSelectedId(null);
    setEditingSetId(null);
    setSetName("Cast");
    setMode("library");
  }

  function beginWithUrl(url: string, file: File | null, existingSetId: string | null, name: string) {
    setPhotoUrl(url);
    setPhotoFile(file);
    setEditingSetId(existingSetId);
    setSetName(name);
    setMarks([]);
    setSelectedId(null);
    setMode("mark");
  }

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Use a photo.");
      return;
    }
    if (ownedUrl) URL.revokeObjectURL(ownedUrl);
    const url = URL.createObjectURL(file);
    setOwnedUrl(url);
    const editId = pendingEditRef.current;
    pendingEditRef.current = null;
    const existing = editId
      ? useFaceSetStore.getState().sets.find((item) => item.id === editId)
      : null;
    beginWithUrl(
      url,
      file,
      editId,
      existing?.name || file.name.replace(/\.[^/.]+$/, "") || "Cast",
    );
  }

  function handleCreate(box: NormBox) {
    const mark: Mark = {
      id: nid(),
      name: `Face ${marks.length + 1}`,
      ...box,
    };
    setMarks((prev) => [...prev, mark]);
    setSelectedId(mark.id);
    return mark.id;
  }

  async function persistSourcePhoto(): Promise<string | null> {
    if (photoFile) {
      const blob = await compressImage(photoFile);
      return putMedia(blob);
    }
    if (!photoUrl) return null;
    const img = await loadImageElement(photoUrl);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.84),
    );
    if (!blob) return null;
    return putMedia(blob);
  }

  async function handleSave() {
    const usable = marks.filter((mark) => mark.width >= 0.04 && mark.height >= 0.04);
    if (!photoUrl || usable.length === 0) {
      toast.error("Mark at least one face on the photo.");
      return;
    }
    setBusy(true);
    try {
      const img = await loadImageElement(photoUrl);
      const faces: FaceSetFace[] = [];
      for (const [index, mark] of usable.entries()) {
        const blob = await cropFaceBlob(img, mark);
        const src = await putMedia(blob);
        faces.push({
          id: nid(),
          name: mark.name.trim() || `Face ${index + 1}`,
          src,
        });
      }
      const sourcePhoto = await persistSourcePhoto();
      if (editingSetId) {
        addFaces(editingSetId, faces);
        renameSet(editingSetId, setName);
      } else {
        createSet(setName, sourcePhoto, faces);
      }
      toast.success(
        usable.length === 1 ? "Saved 1 face." : `Saved ${usable.length} faces.`,
      );
      onCreated?.(faces);
      resetMarkSession();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save that face set.");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "mark" && photoUrl) {
    return (
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="flex min-h-0 flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Drag on the photo to mark a face
          </p>
          <ImageStage imgW={imgSize.w} imgH={imgSize.h} className="aspect-[4/3] min-h-72 rounded-lg">
            <img
              src={photoUrl}
              alt="Face source"
              draggable={false}
              className="absolute inset-0 h-full w-full object-fill pointer-events-none select-none"
              onLoad={(e) => {
                const img = e.currentTarget;
                setImgSize({
                  w: img.naturalWidth || 1600,
                  h: img.naturalHeight || 900,
                });
              }}
            />
            <OvalMarks
              boxes={marks.map((mark, index) => ({
                ...mark,
                label: mark.name || `Face ${index + 1}`,
              }))}
              selectedId={selectedId}
              allowCreate
              onSelect={setSelectedId}
              onChange={(id, next) =>
                setMarks((prev) =>
                  prev.map((mark) => (mark.id === id ? { ...mark, ...next } : mark)),
                )
              }
              onCreate={handleCreate}
              onRemove={(id) => {
                setMarks((prev) => prev.filter((mark) => mark.id !== id));
                setSelectedId((current) => (current === id ? null : current));
              }}
            />
          </ImageStage>
        </div>

        <div className="flex min-h-0 flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="face-set-name">Set name</Label>
            <Input
              id="face-set-name"
              value={setName}
              onChange={(e) => setSetName(e.target.value)}
              placeholder="Cast"
            />
          </div>

          <div className="min-h-0 flex-1 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Marked faces · {marks.length}
            </p>
            {marks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-secondary/50 px-4 py-8 text-center text-sm text-muted-foreground">
                Click and drag around each head. Corners resize. Click a ring to name it.
              </div>
            ) : (
              <ul className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1">
                {marks.map((mark, index) => (
                  <li key={mark.id}>
                    <div
                      className={`flex w-full items-center gap-2 rounded-lg border p-2 transition-colors ${
                        selectedId === mark.id
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedId(mark.id)}
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                        aria-label={`Select ${mark.name || `face ${index + 1}`}`}
                      >
                        {index + 1}
                      </button>
                      <Input
                        value={mark.name}
                        onFocus={() => setSelectedId(mark.id)}
                        onChange={(e) =>
                          setMarks((prev) =>
                            prev.map((item) =>
                              item.id === mark.id ? { ...item, name: e.target.value } : item,
                            ),
                          )
                        }
                        className="h-9"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setMarks((prev) => prev.filter((item) => item.id !== mark.id));
                          setSelectedId((current) => (current === mark.id ? null : current));
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selectedMark ? (
            <p className="text-xs text-muted-foreground">
              Selected {selectedMark.name}. Drag the ring or its corners to fit the head.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={resetMarkSession} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={busy || marks.length === 0}>
              <ScanFace className="size-4" />
              {busy ? "Saving…" : editingSetId ? "Add to set" : "Save face set"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div
        className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-secondary/40 px-6 py-8 text-center"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ScanFace className="size-6" />
        </div>
        <div className="space-y-1">
          <p className="font-medium text-foreground">Mark faces from a photo</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Upload a still, group shot, or character sheet. Draw a ring around each head — those crops become the only faces you can drop onto a panel.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" />
            Upload photo
          </Button>
          {panelImageUrl ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => beginWithUrl(panelImageUrl, null, null, "Panel cast")}
            >
              <ImagePlus className="size-4" />
              Use this panel
            </Button>
          ) : null}
        </div>
      </div>

      {sets.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">
          No face sets yet. Upload a photo and draw a ring around each head.
        </p>
      ) : (
        <ul className="grid min-h-0 gap-3 overflow-y-auto md:grid-cols-2">
          {sets.map((set) => (
            <li key={set.id} className="rounded-xl border border-border bg-card p-3 paper-shadow">
              <div className="mb-2 flex items-start justify-between gap-2">
                <Input
                  defaultValue={set.name}
                  className="h-9 font-medium"
                  onBlur={(e) => renameSet(set.id, e.target.value)}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeSet(set.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="mb-3 flex gap-2 overflow-x-auto">
                {set.faces.map((face) => (
                  <div key={face.id} className="group relative shrink-0">
                    <FaceThumb
                      src={face.src}
                      alt={face.name}
                      className="size-16 rounded-full border border-border"
                    />
                    <button
                      type="button"
                      className="absolute -right-1 -top-1 hidden size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground group-hover:flex"
                      onClick={() => removeFace(set.id, face.id)}
                      aria-label={`Remove ${face.name}`}
                    >
                      <Trash2 className="size-3" />
                    </button>
                    <Input
                      defaultValue={face.name}
                      className="mt-1 h-7 px-1.5 text-xs"
                      onBlur={(e) => renameFace(set.id, face.id, e.target.value)}
                    />
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  pendingEditRef.current = set.id;
                  fileRef.current?.click();
                }}
              >
                Add faces from another photo
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
