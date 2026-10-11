import { useState } from "react";
import {
  Sparkles,
  Users,
  MapPin,
  Palette,
  Plus,
  Pencil,
  Trash2,
  ImagePlus,
  X,
  Check,
  Copy,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useComicStore } from "@/lib/comics/store";
import { compressImage, putMedia, useMediaUrl } from "@/lib/comics/media";
import { nid } from "@/lib/utils";
import type { Comic, CharacterReference, BackgroundReference } from "@/lib/comics/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comic: Comic;
}

const STYLE_PRESETS = [
  {
    name: "Cel-Shaded Anime",
    description: "Modern anime production styling with saturated colors and crisp lines",
    prompt:
      "Vibrant cel-shaded anime illustration, clean digital line art, saturated cinematic lighting, modern Japanese animation aesthetic, high detail.",
  },
  {
    name: "Noir Graphic Novel",
    description: "High contrast chiaroscuro and gritty black ink textures",
    prompt:
      "Black and white graphic novel ink wash, high contrast chiaroscuro, heavy brush inking, dramatic shadows, Frank Miller style, gritty ink texture.",
  },
  {
    name: "Vintage 70s Pulp",
    description: "Bronze Age comic print on warm newsprint paper with halftone dots",
    prompt:
      "1970s bronze age comic book art, slightly off-register halftone CMYK dots, warm aged newsprint paper, bold inked contours, retro print color palette.",
  },
  {
    name: "Manga Screentone",
    description: "Authentic Japanese manga aesthetic with dot screentone shading",
    prompt:
      "Traditional black and white manga ink art, authentic screentone dot shading, sharp dynamic line work, expressive cel shading, manga paneling.",
  },
  {
    name: "Cyber Neon Graphic",
    description: "Glowing synthwave accents on dark, atmospheric backdrops",
    prompt:
      "Neon cyberpunk comic illustration, glowing synthwave accents, dark rainy backdrop, sharp stylized ink lines, volumetric lighting.",
  },
  {
    name: "Dark Knight Modern",
    description: "Gritty, textured dark fantasy comic illustration",
    prompt:
      "Gritty modern dark fantasy comic illustration, painterly textured background, cinematic rim lighting, realistic anatomy, dramatic framing.",
  },
];

const CHARACTER_PRESETS = [
  {
    role: "Protagonist",
    snippet:
      "Adult in early 30s, sharp watchful eyes, weather-beaten leather jacket, fingerless gloves.",
  },
  {
    role: "Investigator",
    snippet:
      "Weary detective, tailored charcoal trench coat, disheveled dark hair, holding a pocket notebook.",
  },
  {
    role: "Cyber Operative",
    snippet:
      "Futuristic street runner, asymmetric neon visor, matte-black tactical hoodie, glowing cybernetic forearm.",
  },
  {
    role: "Mysterious Stranger",
    snippet:
      "Enigmatic figure, hooded cloak casting shadow over face, piercing amber eyes, ornate brass amulet.",
  },
];

const LOCATION_PRESETS = [
  {
    name: "Midnight City Sidewalk",
    snippet:
      "Rain-slicked empty city sidewalk outside glass towers, flickering amber streetlights, deserted crosswalk, midnight fog.",
  },
  {
    name: "Cyberpunk Alleyway",
    snippet:
      "Narrow neon-lit alleyway, overhead tangle of cables, damp pavement reflecting pink and teal holograms, steam vents.",
  },
  {
    name: "Victorian Study",
    snippet:
      "Dimly lit private library, tall mahogany bookshelves, green banker lamp on cluttered desk, velvet curtains.",
  },
  {
    name: "Subway Station Platform",
    snippet:
      "Empty underground transit platform, fluorescent lights, tiled walls covered in retro advertisements, dark tunnel entrance.",
  },
];

function MediaThumbnail({
  refVal,
  alt,
  fallback,
}: {
  refVal?: string;
  alt: string;
  fallback: React.ReactNode;
}) {
  const url = useMediaUrl(refVal ?? null);
  if (url) {
    return <img src={url} alt={alt} className="h-full w-full object-cover" />;
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-secondary text-muted-foreground">
      {fallback}
    </div>
  );
}

export function StoryBibleDialog({ open, onOpenChange, comic }: Props) {
  const store = useComicStore();
  const context = comic.assetContext ?? {};
  const characters = Object.values(context.characters ?? {});
  const backgrounds = Object.values(context.backgrounds ?? {});

  const [activeTab, setActiveTab] = useState<"characters" | "locations" | "style">("characters");

  // Character editing state
  const [editingCharId, setEditingCharId] = useState<string | null>(null);
  const [isAddingChar, setIsAddingChar] = useState(false);
  const [charName, setCharName] = useState("");
  const [charRole, setCharRole] = useState("");
  const [charAppearance, setCharAppearance] = useState("");
  const [charImageRef, setCharImageRef] = useState<string | undefined>(undefined);
  const [isUploadingCharImg, setIsUploadingCharImg] = useState(false);

  // Location editing state
  const [editingBgId, setEditingBgId] = useState<string | null>(null);
  const [isAddingBg, setIsAddingBg] = useState(false);
  const [bgName, setBgName] = useState("");
  const [bgDescription, setBgDescription] = useState("");
  const [bgImageRef, setBgImageRef] = useState<string | undefined>(undefined);
  const [isUploadingBgImg, setIsUploadingBgImg] = useState(false);

  // Style guide state
  const [styleGuideText, setStyleGuideText] = useState(context.styleGuide ?? "");

  function handleStartAddChar() {
    setEditingCharId(null);
    setCharName("");
    setCharRole("");
    setCharAppearance("");
    setCharImageRef(undefined);
    setIsAddingChar(true);
  }

  function handleEditChar(char: CharacterReference) {
    setIsAddingChar(false);
    setEditingCharId(char.id);
    setCharName(char.name);
    setCharRole(char.role ?? "");
    setCharAppearance(char.appearance);
    setCharImageRef(char.imageRef);
  }

  function handleCancelChar() {
    setIsAddingChar(false);
    setEditingCharId(null);
    setCharName("");
    setCharRole("");
    setCharAppearance("");
    setCharImageRef(undefined);
  }

  async function handleCharImageUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file.");
      return;
    }
    setIsUploadingCharImg(true);
    try {
      const blob = await compressImage(file, 800, 0.85);
      const ref = await putMedia(blob);
      setCharImageRef(ref);
      toast.success("Character reference portrait attached.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to process image.");
    } finally {
      setIsUploadingCharImg(false);
    }
  }

  function handleSaveChar(e: React.FormEvent) {
    e.preventDefault();
    if (!charName.trim()) {
      toast.error("Character name is required.");
      return;
    }
    const id = editingCharId || charName.toLowerCase().replace(/[^a-z0-9]/g, "") || nid();
    const newChar: CharacterReference = {
      id,
      name: charName.trim(),
      role: charRole.trim() || undefined,
      appearance: charAppearance.trim() || "Standard comic attire and features.",
      imageRef: charImageRef,
    };
    store.upsertCharacter(comic.id, newChar);
    toast.success(
      editingCharId ? `Updated "${newChar.name}"` : `Added "${newChar.name}" to Story Bible`,
    );
    handleCancelChar();
  }

  function handleDeleteChar(char: CharacterReference) {
    store.deleteCharacter(comic.id, char.id);
    toast.success(`Removed "${char.name}"`);
    if (editingCharId === char.id) handleCancelChar();
  }

  // Location methods
  function handleStartAddBg() {
    setEditingBgId(null);
    setBgName("");
    setBgDescription("");
    setBgImageRef(undefined);
    setIsAddingBg(true);
  }

  function handleEditBg(bg: BackgroundReference) {
    setIsAddingBg(false);
    setEditingBgId(bg.id);
    setBgName(bg.name);
    setBgDescription(bg.description);
    setBgImageRef(bg.imageRef);
  }

  function handleCancelBg() {
    setIsAddingBg(false);
    setEditingBgId(null);
    setBgName("");
    setBgDescription("");
    setBgImageRef(undefined);
  }

  async function handleBgImageUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file.");
      return;
    }
    setIsUploadingBgImg(true);
    try {
      const blob = await compressImage(file, 1200, 0.85);
      const ref = await putMedia(blob);
      setBgImageRef(ref);
      toast.success("Location reference image attached.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to process image.");
    } finally {
      setIsUploadingBgImg(false);
    }
  }

  function handleSaveBg(e: React.FormEvent) {
    e.preventDefault();
    if (!bgName.trim()) {
      toast.error("Location name is required.");
      return;
    }
    const id = editingBgId || bgName.toLowerCase().replace(/[^a-z0-9]/g, "") || nid();
    const newBg: BackgroundReference = {
      id,
      name: bgName.trim(),
      description: bgDescription.trim() || "Scenic environment setting.",
      imageRef: bgImageRef,
    };
    store.upsertBackground(comic.id, newBg);
    toast.success(editingBgId ? `Updated "${newBg.name}"` : `Added "${newBg.name}" to Story Bible`);
    handleCancelBg();
  }

  function handleDeleteBg(bg: BackgroundReference) {
    store.deleteBackground(comic.id, bg.id);
    toast.success(`Removed "${bg.name}"`);
    if (editingBgId === bg.id) handleCancelBg();
  }

  // Style Guide methods
  function handleSaveStyleGuide() {
    store.updateAssetContext(comic.id, { styleGuide: styleGuideText.trim() });
    toast.success("Saved master art style guide.");
  }

  function handleApplyStylePreset(preset: (typeof STYLE_PRESETS)[number]) {
    setStyleGuideText(preset.prompt);
    store.updateAssetContext(comic.id, { styleGuide: preset.prompt });
    toast.success(`Applied style preset: ${preset.name}`);
  }

  // Compiled sample prompt preview
  const sampleChar = characters[0];
  const sampleBg = backgrounds[0];
  const compiledSample = [
    styleGuideText.trim() ? `[ART STYLE]: ${styleGuideText.trim()}` : null,
    sampleBg ? `[SETTING (${sampleBg.name})]: ${sampleBg.description}` : null,
    sampleChar
      ? `[CHARACTERS]: ${sampleChar.name}${sampleChar.role ? ` (${sampleChar.role})` : ""} - ${sampleChar.appearance}`
      : null,
    `[SCENE ACTION]: Characters enter the frame cautiously, surveying the surroundings.`,
    `--ar 16:9 --style raw`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90dvh] overflow-hidden flex flex-col p-4 sm:p-6 bg-card text-card-foreground border-border">
        <DialogHeader className="shrink-0 border-b border-border pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <DialogTitle className="flex items-center gap-2 text-xl font-display uppercase tracking-wider text-foreground">
                <BookOpen className="size-5 text-primary" />
                Story Bible & Continuity Manager
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Maintain character model sheets, recurring environments, and visual style rules for
                AI continuity.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as typeof activeTab)}
            className="w-full flex flex-col h-full"
          >
            <TabsList className="grid grid-cols-3 w-full mb-4 shrink-0 bg-secondary/70">
              <TabsTrigger value="characters" className="text-xs font-semibold gap-1.5">
                <Users className="size-3.5" />
                <span>Characters</span>
                <span className="ml-1 rounded-full bg-primary/20 text-primary px-1.5 py-0.2 text-[10px] font-bold">
                  {characters.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="locations" className="text-xs font-semibold gap-1.5">
                <MapPin className="size-3.5" />
                <span>Locations</span>
                <span className="ml-1 rounded-full bg-primary/20 text-primary px-1.5 py-0.2 text-[10px] font-bold">
                  {backgrounds.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="style" className="text-xs font-semibold gap-1.5">
                <Palette className="size-3.5" />
                <span>Art Style Guide</span>
              </TabsTrigger>
            </TabsList>

            {/* CHARACTERS TAB */}
            <TabsContent value="characters" className="flex-1 space-y-4 outline-none">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Character Model Sheets</h3>
                  <p className="text-xs text-muted-foreground">
                    Consistent descriptions and reference images injected into AI panel prompts.
                  </p>
                </div>
                {!isAddingChar && !editingCharId && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleStartAddChar}
                    className="h-8 gap-1.5 text-xs font-semibold"
                  >
                    <Plus className="size-3.5" />
                    Add Character
                  </Button>
                )}
              </div>

              {/* Character Form (Adding or Editing) */}
              {(isAddingChar || editingCharId) && (
                <form
                  onSubmit={handleSaveChar}
                  className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-primary/20 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-primary">
                      {editingCharId ? "Edit Character Sheet" : "New Character Sheet"}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6 text-muted-foreground hover:text-foreground"
                      onClick={handleCancelChar}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="char-name" className="text-xs">
                        Character Name <span className="text-primary">*</span>
                      </Label>
                      <Input
                        id="char-name"
                        value={charName}
                        onChange={(e) => setCharName(e.target.value)}
                        placeholder="e.g. Elena Vance"
                        className="h-8 text-xs font-medium"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="char-role" className="text-xs">
                        Role / Archetype
                      </Label>
                      <Input
                        id="char-role"
                        value={charRole}
                        onChange={(e) => setCharRole(e.target.value)}
                        placeholder="e.g. Protagonist, Detective, Villain"
                        className="h-8 text-xs font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="char-appearance" className="text-xs">
                        Visual Model Sheet Specs
                      </Label>
                      <span className="text-[10px] text-muted-foreground">
                        Be specific: age, hairstyle, face, clothes, colors
                      </span>
                    </div>
                    <Textarea
                      id="char-appearance"
                      value={charAppearance}
                      onChange={(e) => setCharAppearance(e.target.value)}
                      placeholder="e.g. Late 20s adult woman, navy tailored business suit, white blouse, dark brown bob haircut, carrying a leather briefcase, weary late-shift expression."
                      rows={3}
                      className="text-xs resize-none"
                    />
                  </div>

                  {/* Quick Archetype Snippets */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Inspiration Presets:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {CHARACTER_PRESETS.map((p) => (
                        <button
                          key={p.role}
                          type="button"
                          onClick={() => {
                            setCharRole(p.role);
                            setCharAppearance(p.snippet);
                          }}
                          className="rounded border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-foreground hover:border-primary hover:text-primary transition-colors"
                        >
                          + {p.role}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reference Image Upload */}
                  <div className="space-y-1">
                    <Label className="text-xs">Reference Portrait Image (Optional)</Label>
                    <div className="flex items-center gap-3">
                      <div className="size-16 rounded-md overflow-hidden border border-border shrink-0 bg-secondary/50">
                        <MediaThumbnail
                          refVal={charImageRef}
                          alt="Character Reference"
                          fallback={<Users className="size-6 text-muted-foreground/50" />}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5 flex-1">
                        <label className="inline-flex items-center justify-center h-8 px-3 rounded-md border border-input bg-background text-xs font-medium hover:bg-accent cursor-pointer transition-colors w-fit gap-1.5">
                          <ImagePlus className="size-3.5" />
                          <span>
                            {isUploadingCharImg ? "Processing..." : "Upload Portrait Image"}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void handleCharImageUpload(f);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        {charImageRef && (
                          <button
                            type="button"
                            onClick={() => setCharImageRef(undefined)}
                            className="text-[11px] text-destructive hover:underline text-left w-fit"
                          >
                            Remove portrait reference
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCancelChar}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" className="text-xs font-semibold gap-1.5">
                      <Check className="size-3.5" />
                      Save Character
                    </Button>
                  </div>
                </form>
              )}

              {/* Characters Grid */}
              {characters.length === 0 && !isAddingChar ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center space-y-3">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <Users className="size-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      No characters defined yet
                    </h4>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                      Add your comic's recurring characters with facial features and clothing to
                      maintain visual continuity across AI panel generations.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleStartAddChar}
                    className="gap-1.5 text-xs"
                  >
                    <Plus className="size-3.5" />
                    Create First Character
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {characters.map((char) => (
                    <div
                      key={char.id}
                      className="group flex flex-col justify-between rounded-lg border border-border bg-card p-3 shadow-xs hover:border-foreground/30 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className="size-14 rounded-md overflow-hidden border border-border shrink-0 bg-secondary">
                          <MediaThumbnail
                            refVal={char.imageRef}
                            alt={char.name}
                            fallback={
                              <span className="text-xs font-bold text-muted-foreground uppercase">
                                {char.name.slice(0, 2)}
                              </span>
                            }
                          />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="text-sm font-bold text-foreground truncate">
                              {char.name}
                            </h4>
                            {char.role && (
                              <span className="rounded-full bg-primary/10 border border-primary/20 text-primary px-2 py-0.2 text-[10px] font-semibold shrink-0">
                                {char.role}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                            {char.appearance}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-border/60 pt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          onClick={() => handleEditChar(char)}
                        >
                          <Pencil className="size-3" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteChar(char)}
                        >
                          <Trash2 className="size-3" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* LOCATIONS TAB */}
            <TabsContent value="locations" className="flex-1 space-y-4 outline-none">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Recurring Settings & Locations
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Consistent architectural details, color palettes, and lighting specs for comic
                    scenes.
                  </p>
                </div>
                {!isAddingBg && !editingBgId && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleStartAddBg}
                    className="h-8 gap-1.5 text-xs font-semibold"
                  >
                    <Plus className="size-3.5" />
                    Add Location
                  </Button>
                )}
              </div>

              {/* Location Form */}
              {(isAddingBg || editingBgId) && (
                <form
                  onSubmit={handleSaveBg}
                  className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-primary/20 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-primary">
                      {editingBgId ? "Edit Location Spec" : "New Location Spec"}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6 text-muted-foreground hover:text-foreground"
                      onClick={handleCancelBg}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="bg-name" className="text-xs">
                      Location / Setting Name <span className="text-primary">*</span>
                    </Label>
                    <Input
                      id="bg-name"
                      value={bgName}
                      onChange={(e) => setBgName(e.target.value)}
                      placeholder="e.g. Midnight City Sidewalk"
                      className="h-8 text-xs font-medium"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="bg-description" className="text-xs">
                        Visual Atmosphere & Environment Specs
                      </Label>
                      <span className="text-[10px] text-muted-foreground">
                        Lighting, architecture, weather, colors
                      </span>
                    </div>
                    <Textarea
                      id="bg-description"
                      value={bgDescription}
                      onChange={(e) => setBgDescription(e.target.value)}
                      placeholder="e.g. Rain-slicked empty city sidewalk outside glass office tower, streetlights reflecting on wet asphalt, deserted crosswalk, midnight fog."
                      rows={3}
                      className="text-xs resize-none"
                    />
                  </div>

                  {/* Location Presets */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Inspiration Presets:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {LOCATION_PRESETS.map((p) => (
                        <button
                          key={p.name}
                          type="button"
                          onClick={() => {
                            setBgName(p.name);
                            setBgDescription(p.snippet);
                          }}
                          className="rounded border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-foreground hover:border-primary hover:text-primary transition-colors"
                        >
                          + {p.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reference Image Upload */}
                  <div className="space-y-1">
                    <Label className="text-xs">Location Reference Image (Optional)</Label>
                    <div className="flex items-center gap-3">
                      <div className="size-16 rounded-md overflow-hidden border border-border shrink-0 bg-secondary/50">
                        <MediaThumbnail
                          refVal={bgImageRef}
                          alt="Location Reference"
                          fallback={<MapPin className="size-6 text-muted-foreground/50" />}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5 flex-1">
                        <label className="inline-flex items-center justify-center h-8 px-3 rounded-md border border-input bg-background text-xs font-medium hover:bg-accent cursor-pointer transition-colors w-fit gap-1.5">
                          <ImagePlus className="size-3.5" />
                          <span>
                            {isUploadingBgImg ? "Processing..." : "Upload Backdrop Image"}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void handleBgImageUpload(f);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        {bgImageRef && (
                          <button
                            type="button"
                            onClick={() => setBgImageRef(undefined)}
                            className="text-[11px] text-destructive hover:underline text-left w-fit"
                          >
                            Remove backdrop reference
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCancelBg}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" className="text-xs font-semibold gap-1.5">
                      <Check className="size-3.5" />
                      Save Location
                    </Button>
                  </div>
                </form>
              )}

              {/* Locations Grid */}
              {backgrounds.length === 0 && !isAddingBg ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center space-y-3">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <MapPin className="size-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      No locations saved yet
                    </h4>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                      Register key settings so recurring panels share identical lighting, color
                      palette, and atmosphere.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleStartAddBg}
                    className="gap-1.5 text-xs"
                  >
                    <Plus className="size-3.5" />
                    Create First Location
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {backgrounds.map((bg) => (
                    <div
                      key={bg.id}
                      className="group flex flex-col justify-between rounded-lg border border-border bg-card p-3 shadow-xs hover:border-foreground/30 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className="size-14 rounded-md overflow-hidden border border-border shrink-0 bg-secondary">
                          <MediaThumbnail
                            refVal={bg.imageRef}
                            alt={bg.name}
                            fallback={<MapPin className="size-5 text-muted-foreground" />}
                          />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <h4 className="text-sm font-bold text-foreground truncate">{bg.name}</h4>
                          <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                            {bg.description}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-border/60 pt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          onClick={() => handleEditBg(bg)}
                        >
                          <Pencil className="size-3" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteBg(bg)}
                        >
                          <Trash2 className="size-3" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ART STYLE GUIDE TAB */}
            <TabsContent value="style" className="flex-1 space-y-4 outline-none">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Master Visual Style Guide</h3>
                <p className="text-xs text-muted-foreground">
                  This core artistic specification is prefixed to image prompts and shared with AI
                  assistants to prevent stylistic drift.
                </p>
              </div>

              <div className="space-y-2">
                <Textarea
                  value={styleGuideText}
                  onChange={(e) => setStyleGuideText(e.target.value)}
                  placeholder="e.g. Cel-shaded anime, night city sidewalk, bold ink and flat color. Adult woman in a navy business suit. Fictional."
                  rows={4}
                  className="text-xs font-mono resize-none leading-relaxed"
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveStyleGuide}
                    className="h-8 gap-1.5 text-xs font-semibold"
                  >
                    <Check className="size-3.5" />
                    Save Style Guide
                  </Button>
                </div>
              </div>

              {/* Style Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Curated Comic Aesthetics
                  </span>
                  <span className="text-[10px] text-muted-foreground">Click to apply</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {STYLE_PRESETS.map((preset) => (
                    <div
                      key={preset.name}
                      onClick={() => handleApplyStylePreset(preset)}
                      className={`group cursor-pointer rounded-lg border p-2.5 text-left transition-all ${
                        styleGuideText.includes(preset.name) || styleGuideText === preset.prompt
                          ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                          : "border-border bg-card hover:border-foreground/30 hover:bg-accent/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                          {preset.name}
                        </span>
                        <ArrowRight className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
                        {preset.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Compiled Prompt Preview */}
              <div className="rounded-lg border border-border bg-secondary/40 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-foreground flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-primary" />
                    Live Prompt Compilation Preview
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      navigator.clipboard.writeText(compiledSample);
                      toast.success("Copied sample prompt to clipboard!");
                    }}
                  >
                    <Copy className="size-3" />
                    Copy
                  </Button>
                </div>
                <pre className="text-[11px] font-mono text-muted-foreground bg-background/80 p-2.5 rounded border border-border/60 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {compiledSample}
                </pre>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
