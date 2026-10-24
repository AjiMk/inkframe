import { useState, useEffect, useRef } from "react";
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
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ShieldAlert,
  AlertTriangle,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useComicStore } from "@/lib/comics/store";
import { compressImage, deleteMediaRef, putReferenceMedia, useMediaUrl } from "@/lib/comics/media";
import { makeReferenceId } from "@/lib/comics/references";
import { checkContinuity } from "@/lib/comics/continuity";
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

  const [activeTab, setActiveTab] = useState<"characters" | "locations" | "style" | "continuity">(
    "characters",
  );
  const [continuityFilter, setContinuityFilter] = useState<"all" | "error" | "warning" | "info">(
    "all",
  );

  const continuityReport = checkContinuity(comic);
  const filteredIssues =
    continuityFilter === "all"
      ? continuityReport.issues
      : continuityReport.issues.filter((i) => i.severity === continuityFilter);

  // Character editing state
  const [editingCharId, setEditingCharId] = useState<string | null>(null);
  const [isAddingChar, setIsAddingChar] = useState(false);
  const [charName, setCharName] = useState("");
  const [charRole, setCharRole] = useState("");
  const [charAppearance, setCharAppearance] = useState("");
  const [charImageRefs, setCharImageRefs] = useState<string[]>([]);
  const [isUploadingCharImg, setIsUploadingCharImg] = useState(false);
  const [charAliases, setCharAliases] = useState("");
  const [charTraitFace, setCharTraitFace] = useState("");
  const [charTraitHair, setCharTraitHair] = useState("");
  const [charTraitBuild, setCharTraitBuild] = useState("");
  const [charTraitAge, setCharTraitAge] = useState("");
  const [charSignatureOutfit, setCharSignatureOutfit] = useState("");
  const [charPalette, setCharPalette] = useState("");
  const [charInvariants, setCharInvariants] = useState("");
  const [charVoice, setCharVoice] = useState("");
  const [charAdvancedOpen, setCharAdvancedOpen] = useState(false);

  // Location editing state
  const [editingBgId, setEditingBgId] = useState<string | null>(null);
  const [isAddingBg, setIsAddingBg] = useState(false);
  const [bgName, setBgName] = useState("");
  const [bgDescription, setBgDescription] = useState("");
  const [bgImageRef, setBgImageRef] = useState<string | undefined>(undefined);
  const [isUploadingBgImg, setIsUploadingBgImg] = useState(false);

  // Session draft uploads that have not been committed to the store yet
  const pendingCharUploads = useRef<Set<string>>(new Set());
  const pendingBgUploads = useRef<Set<string>>(new Set());

  // Style guide state
  const [styleGuideText, setStyleGuideText] = useState(context.styleGuide ?? "");
  const isStyleGuideDirty = (context.styleGuide ?? "").trim() !== styleGuideText.trim();

  // Re-sync style guide whenever the dialog opens or the comic's saved style guide changes
  useEffect(() => {
    if (open) {
      setStyleGuideText(context.styleGuide ?? "");
    }
  }, [open, context.styleGuide]);

  function handleStartAddChar() {
    setEditingCharId(null);
    setCharName("");
    setCharRole("");
    setCharAppearance("");
    setCharImageRefs([]);
    setCharAliases("");
    setCharTraitFace("");
    setCharTraitHair("");
    setCharTraitBuild("");
    setCharTraitAge("");
    setCharSignatureOutfit("");
    setCharPalette("");
    setCharInvariants("");
    setCharVoice("");
    setCharAdvancedOpen(false);
    setIsAddingChar(true);
  }

  function handleEditChar(char: CharacterReference) {
    setIsAddingChar(false);
    setEditingCharId(char.id);
    setCharName(char.name);
    setCharRole(char.role ?? "");
    setCharAppearance(char.appearance);
    const initialImages: string[] = [];
    if (char.imageRefs && char.imageRefs.length > 0) {
      initialImages.push(...char.imageRefs.filter(Boolean));
    } else if (char.imageRef) {
      initialImages.push(char.imageRef);
    }
    setCharImageRefs(initialImages);
    setCharAliases(char.aliases ? char.aliases.join(", ") : "");
    setCharTraitFace(char.traits?.face ?? "");
    setCharTraitHair(char.traits?.hair ?? "");
    setCharTraitBuild(char.traits?.build ?? "");
    setCharTraitAge(char.traits?.age ?? "");
    setCharSignatureOutfit(char.signatureOutfit ?? "");
    setCharPalette(char.palette ? char.palette.join(", ") : "");
    setCharInvariants(char.invariants ? char.invariants.join("\n") : "");
    setCharVoice(char.voice ?? "");
    setCharAdvancedOpen(
      Boolean(
        char.aliases?.length ||
        char.traits ||
        char.signatureOutfit ||
        char.palette?.length ||
        char.invariants?.length ||
        char.voice,
      ),
    );
  }

  function handleCancelChar() {
    for (const ref of pendingCharUploads.current) {
      void deleteMediaRef(ref);
    }
    pendingCharUploads.current.clear();
    setIsAddingChar(false);
    setEditingCharId(null);
    setCharName("");
    setCharRole("");
    setCharAppearance("");
    setCharImageRefs([]);
    setCharAliases("");
    setCharTraitFace("");
    setCharTraitHair("");
    setCharTraitBuild("");
    setCharTraitAge("");
    setCharSignatureOutfit("");
    setCharPalette("");
    setCharInvariants("");
    setCharVoice("");
    setCharAdvancedOpen(false);
  }

  function handleRemoveCharImage(indexToRemove: number) {
    const refToRemove = charImageRefs[indexToRemove];
    if (refToRemove && pendingCharUploads.current.has(refToRemove)) {
      void deleteMediaRef(refToRemove);
      pendingCharUploads.current.delete(refToRemove);
    }
    setCharImageRefs((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  }

  async function handleCharImagesUpload(files: FileList | File[]) {
    const validFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (validFiles.length === 0) {
      toast.error("Please select a valid image file.");
      return;
    }
    setIsUploadingCharImg(true);
    try {
      const addedRefs: string[] = [];
      for (const file of validFiles) {
        const blob = await compressImage(file, 800, 0.85);
        const ref = await putReferenceMedia(blob);
        pendingCharUploads.current.add(ref);
        addedRefs.push(ref);
      }
      setCharImageRefs((prev) => [...prev, ...addedRefs]);
      toast.success(
        addedRefs.length > 1
          ? `Attached ${addedRefs.length} reference images.`
          : "Attached reference image.",
      );
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
    const id =
      editingCharId || makeReferenceId(charName.trim(), Object.keys(context.characters ?? {}));

    const aliases = charAliases
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const hasTraits = Boolean(
      charTraitFace.trim() || charTraitHair.trim() || charTraitBuild.trim() || charTraitAge.trim(),
    );
    const traits = hasTraits
      ? {
          face: charTraitFace.trim() || undefined,
          hair: charTraitHair.trim() || undefined,
          build: charTraitBuild.trim() || undefined,
          age: charTraitAge.trim() || undefined,
        }
      : undefined;
    const signatureOutfit = charSignatureOutfit.trim() || undefined;
    const palette = charPalette
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const invariants = charInvariants
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const voice = charVoice.trim() || undefined;

    const validImages = charImageRefs.filter(Boolean);

    const newChar: CharacterReference = {
      id,
      name: charName.trim(),
      role: charRole.trim() || undefined,
      appearance: charAppearance.trim() || "Standard comic attire and features.",
      aliases: aliases.length > 0 ? aliases : undefined,
      traits,
      signatureOutfit,
      palette: palette.length > 0 ? palette : undefined,
      invariants: invariants.length > 0 ? invariants : undefined,
      voice,
      imageRef: validImages[0] || undefined,
      imageRefs: validImages.length > 0 ? validImages : undefined,
    };
    for (const ref of validImages) {
      pendingCharUploads.current.delete(ref);
    }
    for (const ref of pendingCharUploads.current) {
      void deleteMediaRef(ref);
    }
    pendingCharUploads.current.clear();
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
    for (const ref of pendingBgUploads.current) {
      void deleteMediaRef(ref);
    }
    pendingBgUploads.current.clear();
    setIsAddingBg(false);
    setEditingBgId(null);
    setBgName("");
    setBgDescription("");
    setBgImageRef(undefined);
  }

  function handleRemoveBgImage() {
    if (bgImageRef && pendingBgUploads.current.has(bgImageRef)) {
      void deleteMediaRef(bgImageRef);
      pendingBgUploads.current.delete(bgImageRef);
    }
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
      const ref = await putReferenceMedia(blob);
      for (const oldRef of pendingBgUploads.current) {
        void deleteMediaRef(oldRef);
      }
      pendingBgUploads.current.clear();
      pendingBgUploads.current.add(ref);
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
    const id =
      editingBgId || makeReferenceId(bgName.trim(), Object.keys(context.backgrounds ?? {}));
    const newBg: BackgroundReference = {
      id,
      name: bgName.trim(),
      description: bgDescription.trim() || "Scenic environment setting.",
      imageRef: bgImageRef,
    };
    if (bgImageRef) {
      pendingBgUploads.current.delete(bgImageRef);
    }
    for (const ref of pendingBgUploads.current) {
      void deleteMediaRef(ref);
    }
    pendingBgUploads.current.clear();
    store.upsertBackground(comic.id, newBg);
    toast.success(editingBgId ? `Updated "${newBg.name}"` : `Added "${newBg.name}" to Story Bible`);
    handleCancelBg();
  }

  // Clean up uncommitted draft uploads if the dialog closes
  useEffect(() => {
    if (!open) {
      for (const ref of pendingCharUploads.current) {
        void deleteMediaRef(ref);
      }
      pendingCharUploads.current.clear();
      for (const ref of pendingBgUploads.current) {
        void deleteMediaRef(ref);
      }
      pendingBgUploads.current.clear();
      handleCancelChar();
      handleCancelBg();
    }
  }, [open]);

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
            <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full mb-4 shrink-0 bg-secondary/70">
              <TabsTrigger value="characters" className="text-xs font-semibold gap-1.5">
                <Users className="size-3.5" />
                <span>Characters</span>
                <span className="ml-1 rounded-full bg-primary/20 text-primary px-1.5 py-0.5 text-[10px] font-bold">
                  {characters.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="locations" className="text-xs font-semibold gap-1.5">
                <MapPin className="size-3.5" />
                <span>Locations</span>
                <span className="ml-1 rounded-full bg-primary/20 text-primary px-1.5 py-0.5 text-[10px] font-bold">
                  {backgrounds.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="style" className="text-xs font-semibold gap-1.5">
                <Palette className="size-3.5" />
                <span>Style Guide</span>
              </TabsTrigger>
              <TabsTrigger value="continuity" className="text-xs font-semibold gap-1.5">
                {continuityReport.issueCount.errors > 0 ? (
                  <ShieldAlert className="size-3.5 text-destructive" />
                ) : continuityReport.issueCount.warnings > 0 ? (
                  <AlertTriangle className="size-3.5 text-amber-500" />
                ) : (
                  <CheckCircle2 className="size-3.5 text-primary" />
                )}
                <span>Continuity</span>
                {continuityReport.issueCount.errors > 0 ? (
                  <span className="ml-1 rounded-full bg-destructive/20 text-destructive px-1.5 py-0.5 text-[10px] font-bold">
                    {continuityReport.issueCount.errors}
                  </span>
                ) : continuityReport.issueCount.warnings > 0 ? (
                  <span className="ml-1 rounded-full bg-amber-500/20 text-amber-500 px-1.5 py-0.5 text-[10px] font-bold">
                    {continuityReport.issueCount.warnings}
                  </span>
                ) : null}
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

                  {/* Advanced Structured Traits Accordion */}
                  <div className="rounded-md border border-border bg-card/60 p-2.5 space-y-2.5">
                    <button
                      type="button"
                      onClick={() => setCharAdvancedOpen((prev) => !prev)}
                      className="flex w-full items-center justify-between text-xs font-semibold text-foreground hover:text-primary transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-primary" />
                        Structured Details (AI Model Sheet & Consistency)
                      </span>
                      {charAdvancedOpen ? (
                        <ChevronUp className="size-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-3.5 text-muted-foreground" />
                      )}
                    </button>

                    {charAdvancedOpen && (
                      <div className="space-y-3 pt-2 border-t border-border/60">
                        <div className="space-y-1">
                          <Label
                            htmlFor="char-aliases"
                            className="text-[11px] text-muted-foreground"
                          >
                            Aliases / Nicknames (comma-separated)
                          </Label>
                          <Input
                            id="char-aliases"
                            value={charAliases}
                            onChange={(e) => setCharAliases(e.target.value)}
                            placeholder="e.g. Vance, Det. Vance, Number Two"
                            className="h-7 text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">
                            Physical Traits
                          </Label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <Input
                              value={charTraitAge}
                              onChange={(e) => setCharTraitAge(e.target.value)}
                              placeholder="Age: Late 30s"
                              className="h-7 text-xs"
                            />
                            <Input
                              value={charTraitBuild}
                              onChange={(e) => setCharTraitBuild(e.target.value)}
                              placeholder="Build: Athletic"
                              className="h-7 text-xs"
                            />
                            <Input
                              value={charTraitFace}
                              onChange={(e) => setCharTraitFace(e.target.value)}
                              placeholder="Face: Sharp jaw"
                              className="h-7 text-xs"
                            />
                            <Input
                              value={charTraitHair}
                              onChange={(e) => setCharTraitHair(e.target.value)}
                              placeholder="Hair: Black bob"
                              className="h-7 text-xs"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label
                              htmlFor="char-sig-outfit"
                              className="text-[11px] text-muted-foreground"
                            >
                              Signature Outfit
                            </Label>
                            <Input
                              id="char-sig-outfit"
                              value={charSignatureOutfit}
                              onChange={(e) => setCharSignatureOutfit(e.target.value)}
                              placeholder="e.g. Navy tailored coat, high boots"
                              className="h-7 text-xs"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label
                              htmlFor="char-palette"
                              className="text-[11px] text-muted-foreground"
                            >
                              Color Palette (hex codes)
                            </Label>
                            <Input
                              id="char-palette"
                              value={charPalette}
                              onChange={(e) => setCharPalette(e.target.value)}
                              placeholder="#1e293b, #d97706, #3b82f6"
                              className="h-7 text-xs"
                            />
                            {charPalette.trim() && (
                              <div className="flex items-center gap-1 pt-0.5">
                                {charPalette
                                  .split(",")
                                  .map((s) => s.trim())
                                  .filter((c) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c))
                                  .map((c, i) => (
                                    <span
                                      key={i}
                                      className="size-3.5 rounded-full border border-border shadow-2xs"
                                      style={{ backgroundColor: c }}
                                      title={c}
                                    />
                                  ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label
                            htmlFor="char-invariants"
                            className="text-[11px] text-muted-foreground"
                          >
                            Permanent Invariants (Must never change across panels)
                          </Label>
                          <Textarea
                            id="char-invariants"
                            value={charInvariants}
                            onChange={(e) => setCharInvariants(e.target.value)}
                            placeholder="e.g. Diagonal scar over left eyebrow, silver cybernetic eye on right side, antique mechanical pocket watch"
                            rows={2}
                            className="text-xs resize-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor="char-voice" className="text-[11px] text-muted-foreground">
                            Speech Mannerisms & Voice
                          </Label>
                          <Input
                            id="char-voice"
                            value={charVoice}
                            onChange={(e) => setCharVoice(e.target.value)}
                            placeholder="e.g. Terse, cynical, speaks in fragments, avoids contractions"
                            className="h-7 text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Reference Images Upload (Multiple) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">
                        Reference Images{" "}
                        {charImageRefs.length > 0 ? `(${charImageRefs.length})` : "(Optional)"}
                      </Label>
                      <span className="text-[10px] text-muted-foreground">
                        Multiple model sheets, angles, expressions
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      {charImageRefs.map((refVal, idx) => (
                        <div
                          key={`${refVal}-${idx}`}
                          className="group relative size-16 rounded-md overflow-hidden border border-border shrink-0 bg-secondary/50 shadow-2xs"
                        >
                          <MediaThumbnail
                            refVal={refVal}
                            alt={`Reference ${idx + 1}`}
                            fallback={<Users className="size-5 text-muted-foreground/50" />}
                          />
                          {idx === 0 && (
                            <span className="absolute bottom-0.5 left-0.5 rounded bg-primary/90 px-1 py-0.2 text-[8px] font-bold text-primary-foreground leading-tight">
                              Primary
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveCharImage(idx)}
                            aria-label={`Remove reference image ${idx + 1}`}
                            className="absolute top-0.5 right-0.5 size-4 rounded-full bg-destructive/90 text-destructive-foreground opacity-90 hover:opacity-100 flex items-center justify-center shadow-xs transition-opacity"
                          >
                            <X className="size-2.5" />
                          </button>
                        </div>
                      ))}

                      <label className="inline-flex flex-col items-center justify-center size-16 rounded-md border border-dashed border-input hover:border-primary/50 bg-background/50 hover:bg-accent/40 cursor-pointer transition-all gap-1 text-center shrink-0">
                        <ImagePlus className="size-4 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground font-medium leading-none">
                          {isUploadingCharImg ? "..." : "Add"}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            const files = e.target.files;
                            if (files && files.length > 0) void handleCharImagesUpload(files);
                            e.target.value = "";
                          }}
                        />
                      </label>
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
                        {(() => {
                          const imgs =
                            char.imageRefs && char.imageRefs.length > 0
                              ? char.imageRefs
                              : char.imageRef
                                ? [char.imageRef]
                                : [];
                          return (
                            <div className="relative size-14 rounded-md overflow-hidden border border-border shrink-0 bg-secondary">
                              <MediaThumbnail
                                refVal={imgs[0]}
                                alt={char.name}
                                fallback={
                                  <span className="text-xs font-bold text-muted-foreground uppercase">
                                    {char.name.slice(0, 2)}
                                  </span>
                                }
                              />
                              {imgs.length > 1 && (
                                <span
                                  title={`${imgs.length} reference images`}
                                  className="absolute bottom-0.5 right-0.5 rounded bg-black/75 px-1 py-0.2 text-[8px] font-bold text-white shadow-2xs backdrop-blur-xs leading-none"
                                >
                                  +{imgs.length}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="text-sm font-bold text-foreground truncate">
                              {char.name}
                            </h4>
                            {char.role && (
                              <span className="rounded-full bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 text-[10px] font-semibold shrink-0">
                                {char.role}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                            {char.appearance}
                          </p>
                          {char.palette && char.palette.length > 0 && (
                            <div className="flex items-center gap-1 pt-1">
                              <span className="text-[10px] text-muted-foreground font-semibold">
                                Palette:
                              </span>
                              <div className="flex items-center gap-1">
                                {char.palette.map((color, i) => (
                                  <span
                                    key={i}
                                    className="size-3 rounded-full border border-border/80 shadow-2xs"
                                    style={{ backgroundColor: color }}
                                    title={color}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                          {char.invariants && char.invariants.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {char.invariants.map((inv, i) => (
                                <span
                                  key={i}
                                  className="rounded bg-secondary/80 border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground font-medium"
                                >
                                  ✦ {inv}
                                </span>
                              ))}
                            </div>
                          )}
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
                            onClick={handleRemoveBgImage}
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
                <div className="flex items-center justify-between">
                  {isStyleGuideDirty ? (
                    <span className="text-xs text-amber-500 font-medium flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Unsaved style guide changes
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Check className="size-3 text-emerald-500" />
                      Saved
                    </span>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveStyleGuide}
                    disabled={!isStyleGuideDirty}
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

            {/* CONTINUITY TAB */}
            <TabsContent value="continuity" className="flex-1 space-y-4 outline-none">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Continuity & Consistency Audit
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Automated scan verifying character invariants, panel continuity links, and asset
                    integrity.
                  </p>
                </div>
              </div>

              {/* Metrics overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div
                  className={`p-3 rounded-lg border flex flex-col justify-between ${
                    continuityReport.issueCount.errors > 0
                      ? "border-destructive/40 bg-destructive/5"
                      : continuityReport.issueCount.warnings > 0
                        ? "border-amber-500/40 bg-amber-500/5"
                        : "border-primary/40 bg-primary/5"
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Audit Status
                  </span>
                  <div className="mt-1 flex items-center gap-1.5">
                    {continuityReport.issueCount.errors > 0 ? (
                      <>
                        <ShieldAlert className="size-4 text-destructive" />
                        <span className="text-xs font-bold text-destructive">
                          {continuityReport.issueCount.errors} Error
                          {continuityReport.issueCount.errors > 1 ? "s" : ""}
                        </span>
                      </>
                    ) : continuityReport.issueCount.warnings > 0 ? (
                      <>
                        <AlertTriangle className="size-4 text-amber-500" />
                        <span className="text-xs font-bold text-amber-500">
                          {continuityReport.issueCount.warnings} Warning
                          {continuityReport.issueCount.warnings > 1 ? "s" : ""}
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="size-4 text-primary" />
                        <span className="text-xs font-bold text-primary">All Clear</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-border bg-card flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Panel Coverage
                  </span>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-lg font-bold font-display text-foreground">
                      {continuityReport.stats.panelsWithScene}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      / {continuityReport.stats.totalPanels} panels
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-border bg-card flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Characters Cast
                  </span>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-lg font-bold font-display text-foreground">
                      {continuityReport.stats.usedCharacters}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      / {continuityReport.stats.totalCharacters} active
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-border bg-card flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Locations Used
                  </span>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-lg font-bold font-display text-foreground">
                      {continuityReport.stats.usedBackgrounds}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      / {continuityReport.stats.totalBackgrounds} active
                    </span>
                  </div>
                </div>
              </div>

              {/* Filter Chips */}
              <div className="flex items-center gap-1.5 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant={continuityFilter === "all" ? "default" : "outline"}
                  onClick={() => setContinuityFilter("all")}
                  className="h-7 text-[11px] px-2.5 font-semibold"
                >
                  All ({continuityReport.issues.length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={continuityFilter === "error" ? "destructive" : "outline"}
                  onClick={() => setContinuityFilter("error")}
                  disabled={continuityReport.issueCount.errors === 0}
                  className="h-7 text-[11px] px-2.5 font-semibold"
                >
                  Errors ({continuityReport.issueCount.errors})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={continuityFilter === "warning" ? "secondary" : "outline"}
                  onClick={() => setContinuityFilter("warning")}
                  disabled={continuityReport.issueCount.warnings === 0}
                  className="h-7 text-[11px] px-2.5 font-semibold"
                >
                  Warnings ({continuityReport.issueCount.warnings})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={continuityFilter === "info" ? "secondary" : "outline"}
                  onClick={() => setContinuityFilter("info")}
                  disabled={continuityReport.issueCount.infos === 0}
                  className="h-7 text-[11px] px-2.5 font-semibold"
                >
                  Notes ({continuityReport.issueCount.infos})
                </Button>
              </div>

              {/* Issues list */}
              {filteredIssues.length === 0 ? (
                <div className="rounded-lg border border-border/60 bg-secondary/30 p-8 text-center space-y-2">
                  <div className="mx-auto size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <CheckCircle2 className="size-5" />
                  </div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    No Issues Found
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    {continuityFilter === "all"
                      ? "All continuity checks passed! Your comic story bible and panel scenes are completely synchronized."
                      : `No ${continuityFilter} items detected.`}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {filteredIssues.map((issue) => (
                    <div
                      key={issue.id}
                      className={`rounded-lg border p-3 transition-colors ${
                        issue.severity === "error"
                          ? "border-destructive/30 bg-destructive/5"
                          : issue.severity === "warning"
                            ? "border-amber-500/30 bg-amber-500/5"
                            : "border-border bg-card"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 shrink-0">
                          {issue.severity === "error" ? (
                            <ShieldAlert className="size-4 text-destructive" />
                          ) : issue.severity === "warning" ? (
                            <AlertTriangle className="size-4 text-amber-500" />
                          ) : (
                            <Info className="size-4 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                                issue.severity === "error"
                                  ? "bg-destructive/20 text-destructive"
                                  : issue.severity === "warning"
                                    ? "bg-amber-500/20 text-amber-500"
                                    : "bg-primary/20 text-primary"
                              }`}
                            >
                              {issue.severity}
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {issue.type}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-foreground leading-relaxed">
                            {issue.message}
                          </p>
                          {issue.suggestion && (
                            <p className="text-[11px] text-muted-foreground bg-background/60 p-2 rounded border border-border/40 mt-1.5">
                              <span className="font-semibold text-foreground/80">Suggestion: </span>
                              {issue.suggestion}
                            </p>
                          )}
                          {issue.type === "missing-style-guide" && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-6 text-[10px] px-2 font-semibold mt-1"
                              onClick={() => setActiveTab("style")}
                            >
                              Open Style Guide
                            </Button>
                          )}
                          {issue.characterId &&
                            characters.some((c) => c.id === issue.characterId) && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] px-2 font-semibold mt-1"
                                onClick={() => {
                                  const char = characters.find((c) => c.id === issue.characterId);
                                  if (char) {
                                    setActiveTab("characters");
                                    handleEditChar(char);
                                  }
                                }}
                              >
                                Edit Character Sheet
                              </Button>
                            )}
                          {issue.backgroundId &&
                            backgrounds.some((b) => b.id === issue.backgroundId) && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] px-2 font-semibold mt-1"
                                onClick={() => {
                                  const bg = backgrounds.find((b) => b.id === issue.backgroundId);
                                  if (bg) {
                                    setActiveTab("locations");
                                    handleEditBg(bg);
                                  }
                                }}
                              >
                                Edit Location
                              </Button>
                            )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
