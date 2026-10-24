import { panelAspectRatio } from "./layouts.ts";
import type { Comic, PageLayoutId, ShotType } from "./types.ts";

export type PromptTarget = "generic" | "midjourney" | "flux-sd";

export interface PromptBuildOptions {
  target?: PromptTarget;
  backgroundId?: string;
  characterIds?: string[];
  actionDescription?: string;
  shot?: ShotType;
  outfitByCharacter?: Record<string, string>;
}

export interface CharacterPromptPart {
  id: string;
  name: string;
  appearance: string;
  traits?: string;
  outfit?: string;
  invariants?: string[];
  voice?: string;
  imageRef?: string;
  imageRefs?: string[];
}

export interface ReferenceImageItem {
  id?: string;
  url: string;
  type: "character" | "background" | "style";
  label: string;
}

export interface PromptBuildResult {
  target: PromptTarget;
  compiledPrompt: string;
  negativePrompt?: string;
  aspectRatio: string;
  parameters?: Record<string, string>;
  referenceImages: ReferenceImageItem[];
  parts: {
    styleGuide?: string;
    shot?: ShotType;
    background?: { id: string; name: string; description: string };
    characters: CharacterPromptPart[];
    actionDescription: string;
  };
  warnings: string[];
}

export function buildPanelPrompt(
  comic: Comic,
  pageId?: string,
  panelIndex?: number,
  options?: PromptBuildOptions,
): PromptBuildResult {
  const target: PromptTarget = options?.target ?? "generic";
  const warnings: string[] = [];

  const page = pageId ? comic.pages.find((p) => p.id === pageId) : undefined;
  const panel =
    page && panelIndex !== undefined && panelIndex >= 0 && panelIndex < page.panels.length
      ? page.panels[panelIndex]
      : undefined;
  const scene = panel?.scene;

  // Compute aspect ratio
  const layout: PageLayoutId = page?.layout ?? "splash";
  const aspectRatio =
    panelIndex !== undefined && panelIndex >= 0 ? panelAspectRatio(layout, panelIndex) : "1:1";

  // Resolve effective values with options taking precedence over scene metadata
  const effectiveBgId = options?.backgroundId ?? scene?.backgroundId;
  const effectiveCharIds = options?.characterIds ?? scene?.characterIds ?? [];
  const effectiveAction = (options?.actionDescription ?? scene?.action ?? "").trim();
  const effectiveShot = options?.shot ?? scene?.shot;
  const effectiveOutfits = options?.outfitByCharacter ?? scene?.outfitByCharacter ?? {};

  const ctx = comic.assetContext ?? {};
  const styleGuide = ctx.styleGuide?.trim() || undefined;

  if (!styleGuide) {
    warnings.push("Story Bible has no master art style guide set.");
  }
  if (!effectiveAction) {
    warnings.push("No action description specified for this panel.");
  }

  // Resolve Background
  let backgroundPart: { id: string; name: string; description: string } | undefined;
  if (effectiveBgId) {
    const bg = ctx.backgrounds?.[effectiveBgId];
    if (bg) {
      backgroundPart = { id: bg.id, name: bg.name, description: bg.description };
    } else {
      warnings.push(`Background "${effectiveBgId}" is not defined in the Story Bible.`);
    }
  }

  // Resolve Characters
  const characterParts: CharacterPromptPart[] = [];
  const referenceImages: ReferenceImageItem[] = [];

  if (effectiveBgId && ctx.backgrounds?.[effectiveBgId]?.imageRef) {
    const bg = ctx.backgrounds[effectiveBgId];
    referenceImages.push({
      id: bg.id,
      url: bg.imageRef!,
      type: "background",
      label: bg.name,
    });
  }

  for (const charId of effectiveCharIds) {
    const char = ctx.characters?.[charId];
    if (!char) {
      warnings.push(`Character "${charId}" is not defined in the Story Bible.`);
      continue;
    }

    // Format traits
    let traitsSummary: string | undefined;
    if (char.traits) {
      const traitItems = [
        char.traits.age ? `age: ${char.traits.age}` : null,
        char.traits.build ? `build: ${char.traits.build}` : null,
        char.traits.face ? `face: ${char.traits.face}` : null,
        char.traits.hair ? `hair: ${char.traits.hair}` : null,
      ].filter(Boolean);
      if (traitItems.length > 0) traitsSummary = traitItems.join(", ");
    }

    // Determine outfit: custom outfit from scene or signature outfit
    const chosenOutfitId = effectiveOutfits[charId];
    const outfitMatch = chosenOutfitId
      ? char.outfits?.find((o) => o.id === chosenOutfitId)
      : undefined;
    const outfitSummary = outfitMatch
      ? `${outfitMatch.label} (${outfitMatch.description})`
      : char.signatureOutfit;

    const charImages: string[] = [];
    if (char.imageRefs && char.imageRefs.length > 0) {
      charImages.push(...char.imageRefs.filter(Boolean));
    } else if (char.imageRef) {
      charImages.push(char.imageRef);
    }

    characterParts.push({
      id: char.id,
      name: char.name,
      appearance: char.appearance,
      traits: traitsSummary,
      outfit: outfitSummary,
      invariants: char.invariants,
      voice: char.voice,
      imageRef: charImages[0] || char.imageRef,
      imageRefs: charImages.length > 0 ? charImages : undefined,
    });

    if (charImages.length > 0) {
      charImages.forEach((imgRef, idx) => {
        referenceImages.push({
          id: char.id,
          url: imgRef,
          type: "character",
          label: charImages.length > 1 ? `${char.name} (#${idx + 1})` : char.name,
        });
      });
    } else {
      warnings.push(`Character "${char.name}" has no visual portrait reference attached.`);
    }
  }

  let compiledPrompt = "";
  let negativePrompt: string | undefined;
  const parameters: Record<string, string> = {};

  if (target === "midjourney") {
    // Flowing Midjourney prompt format
    const clauses: string[] = [];
    if (effectiveShot) {
      clauses.push(`${effectiveShot} camera shot`);
    }

    if (characterParts.length > 0) {
      const charDescriptions = characterParts.map((c) => {
        const details = [
          c.appearance,
          c.traits,
          c.outfit ? `wearing ${c.outfit}` : null,
          c.invariants?.length ? `features ${c.invariants.join(", ")}` : null,
        ]
          .filter(Boolean)
          .join(", ");
        return `${c.name} (${details})`;
      });
      clauses.push(`featuring ${charDescriptions.join(" and ")}`);
    }

    if (effectiveAction) {
      clauses.push(effectiveAction);
    }

    if (backgroundPart) {
      clauses.push(`set in ${backgroundPart.name}, ${backgroundPart.description}`);
    }

    if (styleGuide) {
      clauses.push(`art style: ${styleGuide}`);
    }

    parameters["--ar"] = aspectRatio;
    compiledPrompt = `${clauses.join(". ")} --ar ${aspectRatio}`;
  } else if (target === "flux-sd") {
    // Comma-delimited token style for Stable Diffusion / Flux
    const tokens: string[] = [];
    if (styleGuide) tokens.push(styleGuide);
    if (effectiveShot) tokens.push(`${effectiveShot} view`);

    for (const c of characterParts) {
      const parts = [
        c.name,
        c.appearance,
        c.traits,
        c.outfit ? `wearing ${c.outfit}` : null,
        c.invariants?.length ? c.invariants.join(", ") : null,
      ]
        .filter(Boolean)
        .join(", ");
      tokens.push(parts);
    }

    if (backgroundPart) {
      tokens.push(`${backgroundPart.name}: ${backgroundPart.description}`);
    }

    if (effectiveAction) {
      tokens.push(effectiveAction);
    }

    compiledPrompt = tokens.join(", ");
    negativePrompt =
      "blurry, bad anatomy, deformed hands, extra limbs, watermark, text artifacts, duplicate heads, low quality, worst quality";
    parameters["aspect_ratio"] = aspectRatio;
  } else {
    // Generic structured bracketed sections
    const sections: string[] = [];

    if (styleGuide) {
      sections.push(`[ART STYLE]: ${styleGuide}`);
    }

    if (effectiveShot) {
      sections.push(`[CAMERA SHOT]: ${effectiveShot}`);
    }

    if (backgroundPart) {
      sections.push(`[SETTING (${backgroundPart.name})]: ${backgroundPart.description}`);
    }

    if (characterParts.length > 0) {
      const charLines = characterParts.map((c) => {
        const extra: string[] = [];
        if (c.traits) extra.push(`Traits: ${c.traits}`);
        if (c.outfit) extra.push(`Outfit: ${c.outfit}`);
        if (c.invariants?.length) extra.push(`Invariants: ${c.invariants.join("; ")}`);
        const extraText = extra.length > 0 ? ` | ${extra.join(" | ")}` : "";
        return `- ${c.name} (${c.appearance})${extraText}`;
      });
      sections.push(`[CHARACTERS]:\n${charLines.join("\n")}`);
    }

    if (effectiveAction) {
      sections.push(`[SCENE ACTION]: ${effectiveAction}`);
    }

    sections.push(`[ASPECT RATIO]: ${aspectRatio}`);
    compiledPrompt = sections.join("\n");
  }

  return {
    target,
    compiledPrompt,
    negativePrompt,
    aspectRatio,
    parameters: Object.keys(parameters).length > 0 ? parameters : undefined,
    referenceImages,
    parts: {
      styleGuide,
      shot: effectiveShot,
      background: backgroundPart,
      characters: characterParts,
      actionDescription: effectiveAction,
    },
    warnings,
  };
}
