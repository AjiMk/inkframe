import fs from "node:fs";
import path from "node:path";
import { nid } from "../utils.ts";
import { defaultCoverConfig, createBubble, emptyPanel } from "./factory.ts";
import { LAYOUTS } from "./layouts.ts";
import { slugifyReferenceName } from "./references.ts";
import type {
  Comic,
  Page,
  Panel,
  PanelFilter,
  PageLayoutId,
  ShotType,
  CharacterReference,
  BackgroundReference,
} from "./types.ts";

export interface StoryboardCharacterGarment {
  stretch?: string;
  garment?: string;
}

export interface StoryboardCharacter {
  name: string;
  role?: string;
  speech?: string;
  hide?: string;
  cannot_say?: string;
  invented?: boolean;
  garments?: StoryboardCharacterGarment[];
}

export interface StoryboardDialogueLine {
  speaker?: string;
  spoken?: string;
  thought?: string;
}

export interface StoryboardScene {
  id: string;
  place?: string;
  time_of_day?: string;
  stretch?: string;
  who?: string[];
  who_can_hear?: string[];
  week?: string;
  body?: string;
  lines?: StoryboardDialogueLine[];
}

export interface StoryboardImageRef {
  file: string;
  role: string;
  text?: string;
}

export interface StoryboardShot {
  scene_id: string;
  order: number;
  beat?: string;
  size?: string;
  position?: string;
  height?: string;
  lens?: string;
  in_frame?: string[];
  watching?: string[];
  eyeline?: Record<string, string>;
  emotion?: string;
  body?: string;
  line_index?: number | null;
  spoken_text?: string;
  lighting?: string;
  wardrobe?: Record<string, string>;
  background?: string;
  stretch?: string;
  image_refs?: StoryboardImageRef[];
  image_prompt?: string;
}

export interface Storyboard {
  language?: string;
  facts?: string[];
  characters?: StoryboardCharacter[];
  scenes?: StoryboardScene[];
  shots?: StoryboardShot[];
}

export interface StoryImportOptions {
  comicId?: string;
  title?: string;
  author?: string;
  framesDir?: string;
  copyAssets?: boolean;
  targetDir?: string;
  filter?: PanelFilter;
}

export interface StoryImportResult {
  comic: Comic;
  pagesCount: number;
  panelsCount: number;
  imagesAssignedCount: number;
  copiedAssetsCount: number;
}

/**
 * Maps a storyboard camera framing to Inkframe ShotType.
 */
export function mapCameraShot(size?: string, height?: string, position?: string): ShotType {
  const h = (height ?? "").toLowerCase();
  const p = (position ?? "").toLowerCase();
  const s = (size ?? "").toLowerCase();

  if (h.includes("low")) return "low-angle";
  if (h.includes("high")) return "high-angle";
  if (p.includes("shoulder")) return "over-shoulder";

  if (s.includes("extreme-close") || s === "ecu") return "extreme-close-up";
  if (s.includes("close")) return "close-up";
  if (s.includes("wide")) return "wide";
  if (s.includes("establishing")) return "establishing";
  return "medium";
}

/**
 * Splits a list of shots into page layout chunks suited for 16:9 widescreen stills.
 * Prefer 'two-v' (stacked wide) and 'three-strip' (cinematic strip) layouts.
 */
export function partitionShotsIntoLayouts(shotCount: number): PageLayoutId[] {
  if (shotCount <= 0) return [];
  if (shotCount === 1) return ["splash"];
  if (shotCount === 2) return ["two-v"];
  if (shotCount === 3) return ["three-strip"];

  const layouts: PageLayoutId[] = [];
  let remaining = shotCount;

  while (remaining > 0) {
    if (remaining === 1) {
      layouts.push("splash");
      remaining -= 1;
    } else if (remaining === 2) {
      layouts.push("two-v");
      remaining -= 2;
    } else if (remaining === 3) {
      layouts.push("three-strip");
      remaining -= 3;
    } else if (remaining === 4) {
      layouts.push("two-v");
      layouts.push("two-v");
      remaining -= 4;
    } else if (remaining % 3 === 0) {
      layouts.push("three-strip");
      remaining -= 3;
    } else {
      layouts.push("two-v");
      remaining -= 2;
    }
  }

  return layouts;
}

function copyFileSafe(src: string, dest: string): boolean {
  try {
    if (!fs.existsSync(src)) return false;
    const destDir = path.dirname(dest);
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, dest);
    return true;
  } catch {
    return false;
  }
}

function findAssetFile(fileName: string, searchDirs: string[]): string | null {
  for (const dir of searchDirs) {
    const candidate = path.join(dir, fileName);
    if (fs.existsSync(candidate)) return candidate;
    // Check case-insensitive
    try {
      if (fs.existsSync(dir)) {
        const entries = fs.readdirSync(dir);
        const match = entries.find((e) => e.toLowerCase() === fileName.toLowerCase());
        if (match) return path.join(dir, match);
      }
    } catch {
      // Continue
    }
  }
  return null;
}

/**
 * Transforms a story breakdown into an Inkframe Comic data structure.
 */
export function importStoryboard(
  story: Storyboard,
  options: StoryImportOptions = {},
): StoryImportResult {
  const rawId = options.comicId || (options.title ? slugifyReferenceName(options.title) : "") || nid();
  const comicId = rawId.startsWith("comic-") ? rawId : `comic-${rawId}`;
  const now = Date.now();

  const title = options.title?.trim() || "The Secret Watch";
  const author = options.author?.trim() || "Shot Agent";
  const defaultFilter = options.filter || "none";

  const framesDir = options.framesDir ? path.resolve(options.framesDir) : null;
  const searchDirs: string[] = [];
  if (framesDir) {
    searchDirs.push(framesDir);
    searchDirs.push(path.join(framesDir, "refs"));
  }

  const targetDir =
    options.targetDir ||
    path.resolve(process.cwd(), "public", "comics", comicId);
  const copyAssets = options.copyAssets !== false && framesDir !== null;

  let copiedAssetsCount = 0;
  let imagesAssignedCount = 0;

  // 1. Build Story Bible Character Model Sheets
  const charactersMap: Record<string, CharacterReference> = {};
  const nameToCharId = new Map<string, string>();

  for (const char of story.characters || []) {
    const id = slugifyReferenceName(char.name) || nid();
    nameToCharId.set(char.name.toLowerCase().trim(), id);

    const invariants = [
      char.cannot_say ? `Cannot say: ${char.cannot_say}` : null,
      char.hide ? `Hides: ${char.hide}` : null,
      char.role ? `Role: ${char.role}` : null,
    ].filter(Boolean) as string[];

    if (invariants.length === 0) {
      invariants.push(`Consistent appearance for ${char.name}`);
    }

    const outfits = (char.garments || []).map((g) => ({
      id: slugifyReferenceName(g.stretch || "default") || "outfit",
      label: g.stretch || "Day",
      description: g.garment || "",
    }));

    let imageRef: string | undefined = undefined;
    if (framesDir) {
      const charPhotoName = `${id}.jpg`;
      const foundPath = findAssetFile(charPhotoName, searchDirs);
      if (foundPath) {
        if (copyAssets) {
          const destPath = path.join(targetDir, "refs", charPhotoName);
          if (copyFileSafe(foundPath, destPath)) {
            copiedAssetsCount++;
            imageRef = `url:/comics/${comicId}/refs/${charPhotoName}`;
          }
        } else {
          imageRef = `url:${foundPath}`;
        }
      }
    }

    charactersMap[id] = {
      id,
      name: char.name,
      role: char.role || "",
      appearance: (char.garments || []).map((g) => `${g.stretch || "Day"}: ${g.garment}`).join("; ") || char.role || "Standard wardrobe",
      voice: char.speech || "",
      invariants,
      outfits,
      imageRef,
    };
  }

  // 2. Build Story Bible Background Reference Specs
  const backgroundsMap: Record<string, BackgroundReference> = {};
  for (const scene of story.scenes || []) {
    const bgId = scene.id;
    let imageRef: string | undefined = undefined;
    if (framesDir) {
      const bgPhotoName = `${bgId}-location.jpg`;
      const foundPath = findAssetFile(bgPhotoName, searchDirs);
      if (foundPath) {
        if (copyAssets) {
          const destPath = path.join(targetDir, "refs", bgPhotoName);
          if (copyFileSafe(foundPath, destPath)) {
            copiedAssetsCount++;
            imageRef = `url:/comics/${comicId}/refs/${bgPhotoName}`;
          }
        } else {
          imageRef = `url:${foundPath}`;
        }
      }
    }

    backgroundsMap[bgId] = {
      id: bgId,
      name: scene.place || scene.id,
      description: `${scene.place || "Location"} (${scene.time_of_day || "Day"}). ${scene.week || scene.body || ""}`.trim(),
      imageRef,
    };
  }

  // 3. Group Shots by Scene & Construct Pages
  const sceneById = new Map<string, StoryboardScene>();
  for (const scene of story.scenes || []) {
    sceneById.set(scene.id, scene);
  }

  const shotsByScene = new Map<string, StoryboardShot[]>();
  for (const shot of story.shots || []) {
    const list = shotsByScene.get(shot.scene_id) || [];
    list.push(shot);
    shotsByScene.set(shot.scene_id, list);
  }

  const pages: Page[] = [];

  for (const scene of story.scenes || []) {
    const sceneShots = shotsByScene.get(scene.id) || [];
    if (sceneShots.length === 0) continue;

    // Sort by order ascending
    sceneShots.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const layoutList = partitionShotsIntoLayouts(sceneShots.length);
    let shotCursor = 0;

    for (const layout of layoutList) {
      const panelCount = LAYOUTS[layout].panelCount;
      const pageShots = sceneShots.slice(shotCursor, shotCursor + panelCount);
      shotCursor += panelCount;

      const panels: Panel[] = [];

      for (let pIdx = 0; pIdx < panelCount; pIdx++) {
        const shot = pageShots[pIdx];
        if (!shot) {
          panels.push(emptyPanel());
          continue;
        }

        const panelId = nid();
        let imageUrl: string | null = null;
        const frameFileName = `${shot.scene_id}-shot-${String((shot.order ?? 0) + 1).padStart(2, "0")}.jpg`;

        if (framesDir) {
          const foundFrame = findAssetFile(frameFileName, searchDirs);
          if (foundFrame) {
            if (copyAssets) {
              const destFrame = path.join(targetDir, frameFileName);
              if (copyFileSafe(foundFrame, destFrame)) {
                copiedAssetsCount++;
                imageUrl = `url:/comics/${comicId}/${frameFileName}`;
                imagesAssignedCount++;
              }
            } else {
              imageUrl = `url:${foundFrame}`;
              imagesAssignedCount++;
            }
          }
        }

        // Map characters in frame
        const inFrameChars: string[] = [];
        for (const item of shot.in_frame || []) {
          const mapped = nameToCharId.get(item.toLowerCase().trim());
          if (mapped && !inFrameChars.includes(mapped)) {
            inFrameChars.push(mapped);
          }
        }

        // Map camera framing
        const cameraShot = mapCameraShot(shot.size, shot.height, shot.position);

        // Action description - mandatory for continuity checks when image is present
        const action = shot.beat || shot.body || scene.place || `Shot ${shot.order + 1} in ${scene.id}`;

        // Map outfits for characters in this panel
        const outfitByCharacter: Record<string, string> = {};
        for (const charId of inFrameChars) {
          const char = charactersMap[charId];
          if (char && char.outfits && char.outfits.length > 0) {
            const stretchSlug = slugifyReferenceName(shot.stretch || "day");
            const matchingOutfit = char.outfits.find((o) => o.id === stretchSlug) || char.outfits[0];
            outfitByCharacter[charId] = matchingOutfit.id;
          }
        }

        // Bubbles
        const bubbles: Panel["bubbles"] = [];

        // Title/Scene Banner on first shot of the scene
        if (shot.order === 0 && scene.place) {
          const bannerText = `${scene.place.toUpperCase()} — ${scene.time_of_day ? scene.time_of_day.toUpperCase() : "DAY"}`;
          const banner = createBubble("title-banner", bannerText);
          banner.x = 4;
          banner.y = 4;
          banner.w = 92;
          bubbles.push(banner);
        }

        // Dialogue line
        const line = shot.line_index != null && scene.lines ? scene.lines[shot.line_index] : null;
        let speakerId: string | undefined = undefined;
        if (line?.speaker) {
          speakerId = nameToCharId.get(line.speaker.toLowerCase().trim());
        }

        const spoken = shot.spoken_text?.trim() || line?.spoken?.trim();
        if (spoken) {
          const speech = createBubble("speech", spoken);
          speech.x = 8;
          speech.y = shot.order === 0 ? 18 : 8;
          speech.w = 46;
          speech.tail = "bl";
          if (speakerId) speech.speakerId = speakerId;
          bubbles.push(speech);
        }

        // Thought line
        if (line?.thought?.trim()) {
          const thought = createBubble("thought", line.thought.trim());
          thought.x = 50;
          thought.y = shot.order === 0 ? 18 : 8;
          thought.w = 44;
          thought.tail = "br";
          if (speakerId) thought.speakerId = speakerId;
          bubbles.push(thought);
        }

        panels.push({
          id: panelId,
          image: imageUrl,
          filter: defaultFilter,
          bubbles,
          scene: {
            characterIds: inFrameChars,
            backgroundId: scene.id,
            shot: cameraShot,
            action,
            ...(Object.keys(outfitByCharacter).length > 0 ? { outfitByCharacter } : {}),
          },
        });
      }

      pages.push({
        id: nid(),
        layout,
        panels,
      });
    }
  }

  // Cover image: first assigned panel image, or default
  const firstImage = pages.flatMap((p) => p.panels).find((p) => p.image)?.image || null;

  const coverConfig = defaultCoverConfig();
  coverConfig.tagline = story.facts?.[0] ? "A STORY IN WIDESCREEN STILLS" : "ORIGINAL STORYBOARD";
  coverConfig.subtitle = story.facts?.[1] || "A DRAMA IN TWELVE SCENES";
  coverConfig.publisherName = "SHOT AGENT & INKFRAME";

  const comic: Comic = {
    id: comicId,
    title,
    author,
    cover: firstImage,
    coverConfig,
    assetContext: {
      styleGuide: "Cinematic 16:9 photoreal widescreen film stills, consistent character lighting and authentic textures.",
      characters: charactersMap,
      backgrounds: backgroundsMap,
    },
    pages: pages.length > 0 ? pages : [emptyPanelPage()],
    createdAt: now,
    updatedAt: now,
  };

  const totalPanels = comic.pages.reduce((acc, p) => acc + p.panels.length, 0);

  return {
    comic,
    pagesCount: comic.pages.length,
    panelsCount: totalPanels,
    imagesAssignedCount,
    copiedAssetsCount,
  };
}

function emptyPanelPage(): Page {
  return {
    id: nid(),
    layout: "splash",
    panels: [emptyPanel()],
  };
}
