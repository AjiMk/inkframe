import type { Comic } from "./types.ts";

export type ContinuityIssueType =
  | "missing-character-ref"
  | "missing-background-ref"
  | "unknown-speaker"
  | "speaker-not-in-scene"
  | "image-without-scene"
  | "unused-character"
  | "unused-background"
  | "missing-character-image"
  | "missing-character-invariants"
  | "missing-style-guide";

export type ContinuitySeverity = "error" | "warning" | "info";

export interface ContinuityIssue {
  id: string;
  type: ContinuityIssueType;
  severity: ContinuitySeverity;
  message: string;
  suggestion?: string;
  pageId?: string;
  pageIndex?: number;
  panelId?: string;
  panelIndex?: number;
  characterId?: string;
  backgroundId?: string;
}

export interface ContinuityStats {
  totalPages: number;
  totalPanels: number;
  panelsWithScene: number;
  panelsWithImage: number;
  totalCharacters: number;
  usedCharacters: number;
  totalBackgrounds: number;
  usedBackgrounds: number;
}

export interface ContinuityReport {
  comicId: string;
  passed: boolean;
  issueCount: {
    errors: number;
    warnings: number;
    infos: number;
  };
  issues: ContinuityIssue[];
  stats: ContinuityStats;
}

/**
 * Runs a comprehensive continuity audit on a comic project.
 * Checks for missing asset references, orphaned dialogue speakers,
 * image panels lacking scene continuity, and character model sheet completeness.
 */
export function checkContinuity(comic: Comic): ContinuityReport {
  const issues: ContinuityIssue[] = [];
  const ctx = comic.assetContext ?? {};
  const characters = ctx.characters ?? {};
  const backgrounds = ctx.backgrounds ?? {};

  const characterKeys = new Set(Object.keys(characters));
  const backgroundKeys = new Set(Object.keys(backgrounds));

  const usedCharacterIds = new Set<string>();
  const usedBackgroundIds = new Set<string>();

  let totalPanels = 0;
  let panelsWithScene = 0;
  let panelsWithImage = 0;

  // 1. Check style guide
  if (!ctx.styleGuide || !ctx.styleGuide.trim()) {
    issues.push({
      id: "missing-style-guide",
      type: "missing-style-guide",
      severity: "warning",
      message: "Comic has no master art style guide defined in the Story Bible.",
      suggestion:
        "Define an art style prompt in the Story Bible to ensure consistent rendering across panels.",
    });
  }

  // 2. Audit character sheets completeness
  for (const [charId, char] of Object.entries(characters)) {
    const hasCharImages =
      (char.imageRefs && char.imageRefs.some((r) => Boolean(r && r.trim()))) ||
      Boolean(char.imageRef && char.imageRef.trim());
    if (!hasCharImages) {
      issues.push({
        id: `missing-image-${charId}`,
        type: "missing-character-image",
        severity: "warning",
        characterId: charId,
        message: `Character "${char.name}" (ID: ${charId}) has no visual reference portrait.`,
        suggestion:
          "Upload a reference model sheet or portrait to provide an image conditioning anchor for AI generation.",
      });
    }

    const hasInvariants = char.invariants && char.invariants.length > 0;
    const hasTraits =
      char.traits &&
      Boolean(
        char.traits.face?.trim() ||
        char.traits.hair?.trim() ||
        char.traits.build?.trim() ||
        char.traits.age?.trim(),
      );

    if (!hasInvariants && !hasTraits) {
      issues.push({
        id: `missing-invariants-${charId}`,
        type: "missing-character-invariants",
        severity: "warning",
        characterId: charId,
        message: `Character "${char.name}" (ID: ${charId}) lacks visual invariants or structured traits.`,
        suggestion:
          "Define immutable visual invariants (e.g. scars, hair color) to prevent character drifting across prompts.",
      });
    }
  }

  // 3. Audit pages, panels, and bubbles
  comic.pages.forEach((page, pageIndex) => {
    page.panels.forEach((panel, panelIndex) => {
      totalPanels++;
      const hasImage = Boolean(panel.image);
      if (hasImage) {
        panelsWithImage++;
      }

      const scene = panel.scene;
      const hasScene = Boolean(
        scene && (scene.action?.trim() || scene.characterIds?.length || scene.backgroundId),
      );
      if (hasScene) {
        panelsWithScene++;
      }

      // Check: panel with image but no scene action
      if (hasImage && (!scene || !scene.action?.trim())) {
        issues.push({
          id: `image-no-scene-${page.id}-${panel.id}`,
          type: "image-without-scene",
          severity: "warning",
          pageId: page.id,
          pageIndex,
          panelId: panel.id,
          panelIndex,
          message: `Page ${pageIndex + 1}, Panel ${panelIndex + 1}: Contains artwork but lacks scene continuity action description.`,
          suggestion:
            "Record the panel's action and continuity metadata to keep future revisions and prompts reproducible.",
        });
      }

      // Check scene background reference
      if (scene?.backgroundId) {
        if (!backgroundKeys.has(scene.backgroundId)) {
          issues.push({
            id: `missing-bg-${page.id}-${panel.id}-${scene.backgroundId}`,
            type: "missing-background-ref",
            severity: "error",
            pageId: page.id,
            pageIndex,
            panelId: panel.id,
            panelIndex,
            backgroundId: scene.backgroundId,
            message: `Page ${pageIndex + 1}, Panel ${panelIndex + 1}: Scene references unknown location "${scene.backgroundId}".`,
            suggestion: `Add location "${scene.backgroundId}" to the Story Bible or update the panel's setting.`,
          });
        } else {
          usedBackgroundIds.add(scene.backgroundId);
        }
      }

      // Check scene character references
      if (scene?.characterIds) {
        for (const charId of scene.characterIds) {
          if (!characterKeys.has(charId)) {
            issues.push({
              id: `missing-char-${page.id}-${panel.id}-${charId}`,
              type: "missing-character-ref",
              severity: "error",
              pageId: page.id,
              pageIndex,
              panelId: panel.id,
              panelIndex,
              characterId: charId,
              message: `Page ${pageIndex + 1}, Panel ${panelIndex + 1}: Scene references unknown character "${charId}".`,
              suggestion: `Add character "${charId}" to the Story Bible or remove them from this panel scene.`,
            });
          } else {
            usedCharacterIds.add(charId);
          }
        }
      }

      // Check scene outfit assignments
      if (scene?.outfitByCharacter) {
        for (const [charId, outfitId] of Object.entries(scene.outfitByCharacter)) {
          if (!characterKeys.has(charId)) {
            issues.push({
              id: `missing-outfit-char-${page.id}-${panel.id}-${charId}`,
              type: "missing-character-ref",
              severity: "error",
              pageId: page.id,
              pageIndex,
              panelId: panel.id,
              panelIndex,
              characterId: charId,
              message: `Page ${pageIndex + 1}, Panel ${panelIndex + 1}: Scene outfit references unknown character "${charId}".`,
              suggestion: `Add character "${charId}" to the Story Bible or remove the outfit assignment.`,
            });
          } else {
            const char = characters[charId];
            if (
              char?.outfits &&
              char.outfits.length > 0 &&
              !char.outfits.some((o) => o.id === outfitId)
            ) {
              issues.push({
                id: `unknown-outfit-${page.id}-${panel.id}-${charId}-${outfitId}`,
                type: "missing-character-invariants",
                severity: "warning",
                pageId: page.id,
                pageIndex,
                panelId: panel.id,
                panelIndex,
                characterId: charId,
                message: `Page ${pageIndex + 1}, Panel ${panelIndex + 1}: Character "${char.name}" has outfit ID "${outfitId}" which does not match any wardrobe outfit in their sheet.`,
                suggestion: `Update the panel outfit or add "${outfitId}" to "${char.name}"'s wardrobe outfits.`,
              });
            }
          }
        }
      }

      // Check speech bubbles
      for (const bubble of panel.bubbles) {
        if (bubble.speakerId) {
          if (!characterKeys.has(bubble.speakerId)) {
            issues.push({
              id: `unknown-speaker-${page.id}-${panel.id}-${bubble.id}-${bubble.speakerId}`,
              type: "unknown-speaker",
              severity: "error",
              pageId: page.id,
              pageIndex,
              panelId: panel.id,
              panelIndex,
              characterId: bubble.speakerId,
              message: `Page ${pageIndex + 1}, Panel ${panelIndex + 1}: Speech bubble references unknown speaker "${bubble.speakerId}".`,
              suggestion:
                "Assign an existing character as speaker or clear the speaker assignment.",
            });
          } else {
            usedCharacterIds.add(bubble.speakerId);
            const speakerName = characters[bubble.speakerId]?.name ?? bubble.speakerId;
            const isInPanelCharacters = scene?.characterIds?.includes(bubble.speakerId);

            if (!isInPanelCharacters) {
              issues.push({
                id: `speaker-not-in-scene-${page.id}-${panel.id}-${bubble.id}-${bubble.speakerId}`,
                type: "speaker-not-in-scene",
                severity: "info",
                pageId: page.id,
                pageIndex,
                panelId: panel.id,
                panelIndex,
                characterId: bubble.speakerId,
                message: `Page ${pageIndex + 1}, Panel ${panelIndex + 1}: Speaker "${speakerName}" speaks here but is not listed in the panel scene's character roster.`,
                suggestion:
                  "If this character appears on-screen, add them to the panel scene. If this is off-panel dialogue, you can ignore this note.",
              });
            }
          }
        }
      }
    });
  });

  // 4. Audit unused references
  for (const [charId, char] of Object.entries(characters)) {
    if (!usedCharacterIds.has(charId)) {
      issues.push({
        id: `unused-char-${charId}`,
        type: "unused-character",
        severity: "info",
        characterId: charId,
        message: `Character "${char.name}" (ID: ${charId}) is defined in the Story Bible but never used in any panel.`,
        suggestion: "Cast this character in a panel scene or keep them ready for future pages.",
      });
    }
  }

  for (const [bgId, bg] of Object.entries(backgrounds)) {
    if (!usedBackgroundIds.has(bgId)) {
      issues.push({
        id: `unused-bg-${bgId}`,
        type: "unused-background",
        severity: "info",
        backgroundId: bgId,
        message: `Location "${bg.name}" (ID: ${bgId}) is defined in the Story Bible but never used in any panel.`,
        suggestion: "Use this background in a panel scene or keep it ready for future pages.",
      });
    }
  }

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const infos = issues.filter((i) => i.severity === "info").length;

  return {
    comicId: comic.id,
    passed: errors === 0,
    issueCount: {
      errors,
      warnings,
      infos,
    },
    issues,
    stats: {
      totalPages: comic.pages.length,
      totalPanels,
      panelsWithScene,
      panelsWithImage,
      totalCharacters: characterKeys.size,
      usedCharacters: usedCharacterIds.size,
      totalBackgrounds: backgroundKeys.size,
      usedBackgrounds: usedBackgroundIds.size,
    },
  };
}

/**
 * Pure function to delete a character from a comic and cascade removal to all
 * panel scenes (characterIds, outfitByCharacter) and dialogue bubbles (speakerId).
 */
export function deleteCharacterFromComic(comic: Comic, characterId: string): Comic {
  const ctx = comic.assetContext ?? {};
  if (!ctx.characters || !ctx.characters[characterId]) {
    return comic;
  }

  const { [characterId]: _deleted, ...remainingCharacters } = ctx.characters;

  const pages = comic.pages.map((page) => ({
    ...page,
    panels: page.panels.map((panel) => {
      let updatedPanel = panel;

      if (panel.scene) {
        const remainingCharIds = panel.scene.characterIds?.filter((id) => id !== characterId);
        let remainingOutfits = panel.scene.outfitByCharacter;
        if (remainingOutfits && characterId in remainingOutfits) {
          const { [characterId]: _outfit, ...restOutfits } = remainingOutfits;
          remainingOutfits = Object.keys(restOutfits).length > 0 ? restOutfits : undefined;
        }

        const nextScene = {
          ...panel.scene,
          characterIds: remainingCharIds?.length ? remainingCharIds : undefined,
          outfitByCharacter: remainingOutfits,
        };

        const hasSceneContent = Boolean(
          nextScene.action?.trim() ||
          nextScene.characterIds?.length ||
          nextScene.backgroundId ||
          nextScene.shot ||
          (nextScene.outfitByCharacter && Object.keys(nextScene.outfitByCharacter).length > 0),
        );

        updatedPanel = {
          ...updatedPanel,
          scene: hasSceneContent ? nextScene : undefined,
        };
      }

      if (panel.bubbles.some((b) => b.speakerId === characterId)) {
        updatedPanel = {
          ...updatedPanel,
          bubbles: panel.bubbles.map((b) =>
            b.speakerId === characterId ? { ...b, speakerId: undefined } : b,
          ),
        };
      }

      return updatedPanel;
    }),
  }));

  return {
    ...comic,
    pages,
    assetContext: {
      ...ctx,
      characters: remainingCharacters,
    },
    updatedAt: Date.now(),
  };
}

/**
 * Pure function to delete a background from a comic and cascade removal
 * from any panel scenes referencing it.
 */
export function deleteBackgroundFromComic(comic: Comic, backgroundId: string): Comic {
  const ctx = comic.assetContext ?? {};
  if (!ctx.backgrounds || !ctx.backgrounds[backgroundId]) {
    return comic;
  }

  const { [backgroundId]: _deleted, ...remainingBackgrounds } = ctx.backgrounds;

  const pages = comic.pages.map((page) => ({
    ...page,
    panels: page.panels.map((panel) => {
      if (panel.scene?.backgroundId !== backgroundId) {
        return panel;
      }
      const { backgroundId: _bg, ...remainingScene } = panel.scene;
      const hasSceneContent = Boolean(
        remainingScene.action?.trim() ||
        remainingScene.characterIds?.length ||
        remainingScene.shot ||
        (remainingScene.outfitByCharacter &&
          Object.keys(remainingScene.outfitByCharacter).length > 0),
      );
      return {
        ...panel,
        scene: hasSceneContent ? remainingScene : undefined,
      };
    }),
  }));

  return {
    ...comic,
    pages,
    assetContext: {
      ...ctx,
      backgrounds: remainingBackgrounds,
    },
    updatedAt: Date.now(),
  };
}
