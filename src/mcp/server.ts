import fs from "node:fs";
import path from "node:path";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  changePageLayoutPreservingImages,
  createComic,
  createPage,
  createBubble,
  defaultCoverConfig,
  FILTERS,
} from "../lib/comics/factory.ts";
import { LAYOUTS } from "../lib/comics/layouts.ts";
import {
  readComicsFromDisk,
  atomicWriteJsonSync,
  DEFAULT_STORAGE_PATH,
} from "../lib/comics/sync-node.ts";
import { buildPanelPrompt } from "../lib/comics/prompt-builder.ts";
import type {
  Comic,
  PageLayoutId,
  BubbleKind,
  PanelFilter,
  CoverTemplateStyle,
} from "../lib/comics/types.ts";

function loadStore(): Map<string, Comic> {
  const store = new Map<string, Comic>();
  const list = readComicsFromDisk();
  for (const c of list) {
    store.set(c.id, c);
  }
  return store;
}

function persistStore(store: Map<string, Comic>) {
  const list = Array.from(store.values());
  atomicWriteJsonSync(DEFAULT_STORAGE_PATH, list);
}

function mutateStore<T>(fn: (store: Map<string, Comic>) => T): T {
  const store = loadStore();
  const res = fn(store);
  persistStore(store);
  return res;
}

const server = new McpServer({
  name: "inkframe-mcp-server",
  version: "1.0.0",
});

// --- RESOURCES ---

// Resource 1: Available page layouts
server.resource("layouts", "inkframe://layouts", async (uri) => ({
  contents: [
    {
      uri: uri.href,
      text: JSON.stringify(
        Object.entries(LAYOUTS).map(([id, layout]) => ({
          id,
          label: layout.label,
          panelCount: layout.panelCount,
        })),
        null,
        2,
      ),
      mimeType: "application/json",
    },
  ],
}));

// Resource 2: Available comic filters
server.resource("filters", "inkframe://filters", async (uri) => ({
  contents: [
    {
      uri: uri.href,
      text: JSON.stringify(FILTERS, null, 2),
      mimeType: "application/json",
    },
  ],
}));

// Resource 4: Active Comic Full Context by ID
server.resource(
  "comic-context",
  new ResourceTemplate("inkframe://comics/{comicId}", { list: undefined }),
  async (uri, { comicId }) => {
    const store = loadStore();
    const id = String(comicId ?? "");
    const comic = id ? store.get(id) : null;
    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(comic ?? { error: "Comic not found", comicId: id }, null, 2),
          mimeType: "application/json",
        },
      ],
    };
  },
);

// Resource 5: Comic Visual References (Characters & Background Context)
server.resource(
  "comic-references",
  new ResourceTemplate("inkframe://comics/{comicId}/references", { list: undefined }),
  async (uri, { comicId }) => {
    const store = loadStore();
    const id = String(comicId ?? "");
    const comic = id ? store.get(id) : null;
    const rawContext = comic?.assetContext ?? {
      styleGuide: "Default clean comic book style",
      backgrounds: {},
      characters: {},
    };

    const characters = Object.fromEntries(
      Object.entries(rawContext.characters ?? {}).map(([cId, c]) => [
        cId,
        {
          ...c,
          hasImage: Boolean(c.imageRef),
        },
      ]),
    );

    const backgrounds = Object.fromEntries(
      Object.entries(rawContext.backgrounds ?? {}).map(([bId, b]) => [
        bId,
        {
          ...b,
          hasImage: Boolean(b.imageRef),
        },
      ]),
    );

    const enrichedContext = {
      ...rawContext,
      characters,
      backgrounds,
    };

    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(enrichedContext, null, 2),
          mimeType: "application/json",
        },
      ],
    };
  },
);

// --- PROMPTS (Contextual Templates) ---

// Prompt 1: Manga Story Generator Context
server.prompt(
  "generate-manga-story",
  "Template to generate a multi-page manga chapter with screen-tone filters and action dialogue",
  {
    title: z.string().describe("Manga title"),
    theme: z.string().describe("Genre/Theme (e.g. Cyberpunk Ninja, Supernatural, Sci-Fi)"),
  },
  ({ title, theme }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Create a compelling 3-page comic outline for a manga titled "${title}" with the theme "${theme}".

For each page, suggest:
1. Panel layout pattern ("splash", "two-v", "two-h", "three-strip", "four-grid", "wide-then-two", "two-then-wide", "spotlight")
2. Visual description for each panel (including camera angle, mood, and composition)
3. Recommended panel filter (e.g. "manga-screentone", "noir", "ink", "cyber-neon")
4. Dialogue or sound effects to place in each panel (kinds: "speech", "thought", "shout", "caption", "sfx", "title-banner", "burst-label")
5. Character appearances and recurring background locations to save in the Story Bible

Then use the inkframe tools to create the comic, add the pages, and attach dialogue elements!`,
        },
      },
    ],
  }),
);

// Prompt 2: Noir Detective Issue Context
server.prompt(
  "noir-detective-case",
  "Template for creating a gritty hardboiled crime mystery comic",
  {
    detectiveName: z.string().describe("Name of the lead investigator"),
    caseSubject: z.string().describe("The crime or mystery being investigated"),
  },
  ({ detectiveName, caseSubject }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Develop a classic pulp noir comic chapter featuring ${detectiveName} investigating "${caseSubject}".

Design requirements:
- Use "noir" or "anaglyph-3d" filter for dark, moody chiaroscuro lighting
- Heavy use of "caption" bubbles for internal hardboiled narration
- Use "classic-3d" or "distressed-pulp" title typography
- Include at least one confrontation with "shout" bubbles or "sfx" impacts
- Store ${detectiveName}'s visual character sheet and key crime scene location using set_comic_references`,
        },
      },
    ],
  }),
);

// --- TOOLS ---

// Tool 1: List comics
server.tool("list_comics", "List all comics created in this session", {}, async () => {
  const store = loadStore();
  const list = Array.from(store.values()).map((c) => ({
    id: c.id,
    title: c.title,
    author: c.author,
    pageCount: c.pages.length,
    createdAt: new Date(c.createdAt).toISOString(),
  }));
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(list, null, 2),
      },
    ],
  };
});

// Tool 2: Create comic
server.tool(
  "create_comic",
  "Create a new comic book with title, author, and default cover",
  {
    title: z.string().describe("Title of the comic book"),
    author: z.string().optional().describe("Author or creator byline"),
  },
  async ({ title, author }) => {
    return mutateStore((store) => {
      const comic = createComic(title, author ?? "Anonymous");
      store.set(comic.id, comic);
      return {
        content: [
          {
            type: "text",
            text: `Created comic "${comic.title}" (ID: ${comic.id}) with 1 splash page.`,
          },
        ],
      };
    });
  },
);

// Tool 3: Get comic detail
server.tool(
  "get_comic",
  "Get the full JSON structure of a comic by ID",
  {
    comicId: z.string().describe("ID of the comic to retrieve"),
  },
  async ({ comicId }) => {
    const store = loadStore();
    const comic = store.get(comicId);
    if (!comic) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Comic with ID "${comicId}" not found.`,
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(comic, null, 2),
        },
      ],
    };
  },
);

// Tool 4: Add page
server.tool(
  "add_page",
  "Add a new page to a comic with a specific panel layout",
  {
    comicId: z.string().describe("ID of the comic"),
    layout: z
      .enum([
        "splash",
        "two-v",
        "two-h",
        "three-strip",
        "four-grid",
        "wide-then-two",
        "two-then-wide",
        "spotlight",
      ])
      .describe("Page layout pattern"),
  },
  async ({ comicId, layout }) => {
    return mutateStore((store) => {
      const comic = store.get(comicId);
      if (!comic) {
        return {
          isError: true,
          content: [{ type: "text", text: `Comic "${comicId}" not found.` }],
        };
      }
      const page = createPage(layout as PageLayoutId);
      comic.pages.push(page);
      comic.updatedAt = Date.now();
      return {
        content: [
          {
            type: "text",
            text: `Added Page ${comic.pages.length} (ID: ${page.id}) with layout "${layout}" (${page.panels.length} panels) to "${comic.title}".`,
          },
        ],
      };
    });
  },
);

// Tool 4b: Set page layout
server.tool(
  "set_page_layout",
  "Change the panel layout of an existing page in a comic",
  {
    comicId: z.string().describe("ID of the comic"),
    pageId: z.string().describe("ID of the page"),
    layout: z
      .enum([
        "splash",
        "two-v",
        "two-h",
        "three-strip",
        "four-grid",
        "wide-then-two",
        "two-then-wide",
        "spotlight",
      ])
      .describe("Page layout pattern"),
  },
  async ({ comicId, pageId, layout }) => {
    return mutateStore((store) => {
      const comic = store.get(comicId);
      if (!comic) {
        return {
          isError: true,
          content: [{ type: "text", text: `Comic "${comicId}" not found.` }],
        };
      }
      const updated = changePageLayoutPreservingImages(comic, pageId, layout as PageLayoutId);
      store.set(comicId, { ...updated, updatedAt: Date.now() });
      return {
        content: [
          {
            type: "text",
            text: `Updated Page layout to "${layout}" while preserving all panel images.`,
          },
        ],
      };
    });
  },
);

// Tool 5: Add dialogue or SFX element
server.tool(
  "add_dialogue",
  "Add a speech bubble, thought balloon, shout box, SFX sound effect ('KAPOW!'), scene banner, or starburst badge to a panel",
  {
    comicId: z.string().describe("ID of the comic"),
    pageId: z.string().describe("ID of the page"),
    panelIndex: z.number().int().min(0).describe("Panel index on the page (0-based)"),
    kind: z
      .enum(["speech", "thought", "shout", "caption", "sfx", "title-banner", "burst-label"])
      .describe("Style / type of dialogue element"),
    text: z.string().optional().describe("Text content for the dialogue element"),
    speakerId: z.string().optional().describe("ID of the character speaking this line"),
  },
  async ({ comicId, pageId, panelIndex, kind, text, speakerId }) => {
    return mutateStore((store) => {
      const comic = store.get(comicId);
      if (!comic) {
        return {
          isError: true,
          content: [{ type: "text", text: `Comic "${comicId}" not found.` }],
        };
      }
      const page = comic.pages.find((p) => p.id === pageId);
      if (!page) {
        return { isError: true, content: [{ type: "text", text: `Page "${pageId}" not found.` }] };
      }
      const panel = page.panels[panelIndex];
      if (!panel) {
        return {
          isError: true,
          content: [{ type: "text", text: `Panel index ${panelIndex} out of bounds.` }],
        };
      }

      if (speakerId) {
        const char = comic.assetContext?.characters?.[speakerId];
        if (!char) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Speaker character "${speakerId}" not found in comic characters.`,
              },
            ],
          };
        }
      }

      const bubble = createBubble(kind as BubbleKind, text);
      if (speakerId) {
        bubble.speakerId = speakerId;
      }
      panel.bubbles.push(bubble);
      comic.updatedAt = Date.now();

      return {
        content: [
          {
            type: "text",
            text: `Added ${kind} bubble ("${bubble.text}")${speakerId ? ` spoken by "${speakerId}"` : ""} to Panel ${panelIndex + 1} on Page ${pageId}.`,
          },
        ],
      };
    });
  },
);

// Tool 6: Update Cover Config
server.tool(
  "update_cover_config",
  "Customize comic cover page template, tagline, issue info, and title style",
  {
    comicId: z.string().describe("ID of the comic"),
    template: z
      .enum(["classic", "action", "vintage", "pulp", "graphic-novel"])
      .optional()
      .describe("Cover template theme"),
    titleStyle: z
      .enum(["classic-3d", "retro-bold", "neon-glitch", "distressed-pulp"])
      .optional()
      .describe("3D title typography style"),
    tagline: z.string().optional().describe("Ribbon tagline at top of cover"),
    subtitle: z.string().optional().describe("Subtitle text beneath title"),
    issueNumber: z.string().optional().describe("Issue number (e.g. '#1')"),
    issuePrice: z.string().optional().describe("Cover price (e.g. '25¢')"),
    issueDate: z.string().optional().describe("Vol/Date header (e.g. 'VOL. 1')"),
  },
  async ({
    comicId,
    template,
    titleStyle,
    tagline,
    subtitle,
    issueNumber,
    issuePrice,
    issueDate,
  }) => {
    return mutateStore((store) => {
      const comic = store.get(comicId);
      if (!comic) {
        return {
          isError: true,
          content: [{ type: "text", text: `Comic "${comicId}" not found.` }],
        };
      }

      comic.coverConfig = {
        ...defaultCoverConfig(),
        ...comic.coverConfig,
        ...(template && { template: template as CoverTemplateStyle }),
        ...(titleStyle && { titleStyle }),
        ...(tagline !== undefined && { tagline }),
        ...(subtitle !== undefined && { subtitle }),
        ...(issueNumber !== undefined && { issueNumber }),
        ...(issuePrice !== undefined && { issuePrice }),
        ...(issueDate !== undefined && { issueDate }),
      };
      comic.updatedAt = Date.now();

      return {
        content: [
          {
            type: "text",
            text: `Updated cover page config for "${comic.title}".`,
          },
        ],
      };
    });
  },
);

// Tool 7: Apply Comic Filter
server.tool(
  "apply_panel_filter",
  "Apply an authentic comic book aesthetic filter to a panel",
  {
    comicId: z.string().describe("ID of the comic"),
    pageId: z.string().describe("ID of the page"),
    panelIndex: z.number().int().min(0).describe("Panel index on page (0-based)"),
    filter: z
      .enum([
        "none",
        "ink",
        "noir",
        "halftone",
        "sepia",
        "vintage",
        "pop-art",
        "cyber-neon",
        "graphic-novel",
        "anime-cel",
        "pencil-sketch",
        "manga-screentone",
        "anaglyph-3d",
        "golden-pulp",
        "dark-knight",
        "technicolor",
      ])
      .describe("Filter style"),
  },
  async ({ comicId, pageId, panelIndex, filter }) => {
    return mutateStore((store) => {
      const comic = store.get(comicId);
      if (!comic) {
        return {
          isError: true,
          content: [{ type: "text", text: `Comic "${comicId}" not found.` }],
        };
      }
      const page = comic.pages.find((p) => p.id === pageId);
      if (!page) {
        return { isError: true, content: [{ type: "text", text: `Page "${pageId}" not found.` }] };
      }
      const panel = page.panels[panelIndex];
      if (!panel) {
        return {
          isError: true,
          content: [{ type: "text", text: `Panel index ${panelIndex} out of bounds.` }],
        };
      }

      panel.filter = filter as PanelFilter;
      comic.updatedAt = Date.now();

      return {
        content: [
          {
            type: "text",
            text: `Applied "${filter}" filter to Panel ${panelIndex + 1} on Page ${pageId}.`,
          },
        ],
      };
    });
  },
);

// Tool 8: Set Comic References (Character Sheets & Background Context)
server.tool(
  "set_comic_references",
  "Save character reference sheets, background reference specs, and visual style guides for consistent panel generation",
  {
    comicId: z.string().describe("ID of the comic"),
    styleGuide: z.string().optional().describe("Overall visual art style guide"),
    backgrounds: z
      .array(
        z.object({
          id: z.string().describe("Unique identifier for background (e.g., 'livingRoom')"),
          name: z.string().describe("Human-readable name"),
          description: z
            .string()
            .describe("Detailed visual prompt specs (lighting, furniture, palette)"),
          imageRef: z.string().optional().describe("Optional URL or base64 reference image"),
        }),
      )
      .optional()
      .describe("Array of background references"),
    characters: z
      .array(
        z.object({
          id: z.string().describe("Unique identifier for character (e.g., 'surabhi')"),
          name: z.string().describe("Character name"),
          role: z.string().optional().describe("Role in story"),
          appearance: z
            .string()
            .describe(
              "Detailed model sheet summary (age, height, complexion, hairstyle, clothing)",
            ),
          aliases: z.array(z.string()).optional().describe("Known aliases or alternate names"),
          traits: z
            .object({
              face: z.string().optional(),
              hair: z.string().optional(),
              build: z.string().optional(),
              age: z.string().optional(),
            })
            .optional()
            .describe("Structured physical traits"),
          signatureOutfit: z.string().optional().describe("Default signature attire"),
          palette: z.array(z.string()).optional().describe("Hex color palette (e.g. ['#1e293b'])"),
          invariants: z
            .array(z.string())
            .optional()
            .describe("Permanent visual rules that never change (e.g. 'scar over left eyebrow')"),
          outfits: z
            .array(
              z.object({
                id: z.string(),
                label: z.string(),
                description: z.string(),
              }),
            )
            .optional()
            .describe("Known wardrobe outfits"),
          voice: z.string().optional().describe("Speech habits and dialogue style"),
          imageRef: z.string().optional().describe("Optional character sheet reference image"),
        }),
      )
      .optional()
      .describe("Array of character model sheets"),
  },
  async ({ comicId, styleGuide, backgrounds, characters }) => {
    return mutateStore((store) => {
      const comic = store.get(comicId);
      if (!comic) {
        return {
          isError: true,
          content: [{ type: "text", text: `Comic "${comicId}" not found.` }],
        };
      }

      if (!comic.assetContext) {
        comic.assetContext = { styleGuide: "", backgrounds: {}, characters: {} };
      }

      if (styleGuide !== undefined) {
        comic.assetContext.styleGuide = styleGuide;
      }

      if (backgrounds) {
        if (!comic.assetContext.backgrounds) comic.assetContext.backgrounds = {};
        for (const bg of backgrounds) {
          comic.assetContext.backgrounds[bg.id] = bg;
        }
      }

      if (characters) {
        if (!comic.assetContext.characters) comic.assetContext.characters = {};
        for (const char of characters) {
          comic.assetContext.characters[char.id] = char;
        }
      }

      comic.updatedAt = Date.now();

      const charCount = Object.keys(comic.assetContext.characters || {}).length;
      const bgCount = Object.keys(comic.assetContext.backgrounds || {}).length;

      return {
        content: [
          {
            type: "text",
            text: `Updated reference context for "${comic.title}". Registered ${charCount} character model sheets and ${bgCount} background references.`,
          },
        ],
      };
    });
  },
);

// Tool 9: Get Panel Prompt (Compiles consistent character & background context)
server.tool(
  "get_panel_prompt",
  "Build a unified, visually consistent image generation prompt combining background specs, character model sheets, and action description",
  {
    comicId: z.string().describe("ID of the comic"),
    pageId: z.string().optional().describe("Optional page ID to read panel scene metadata from"),
    panelIndex: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Optional 0-based panel index to read scene metadata from"),
    target: z
      .enum(["generic", "midjourney", "flux-sd"])
      .optional()
      .describe("Target generator format: generic, midjourney, or flux-sd (defaults to generic)"),
    backgroundId: z
      .string()
      .optional()
      .describe("ID of the background reference (e.g. 'livingRoom')"),
    characterIds: z
      .array(z.string())
      .optional()
      .describe("Array of character IDs present in this panel"),
    actionDescription: z
      .string()
      .optional()
      .describe("Detailed description of action/scene in this specific panel"),
    shot: z
      .enum([
        "establishing",
        "wide",
        "medium",
        "close-up",
        "extreme-close-up",
        "low-angle",
        "high-angle",
        "over-shoulder",
        "dutch",
      ])
      .optional()
      .describe("Camera shot angle/framing"),
    outfitByCharacter: z
      .record(z.string(), z.string())
      .optional()
      .describe("Map of character ID to specific outfit ID"),
  },
  async ({
    comicId,
    pageId,
    panelIndex,
    target,
    backgroundId,
    characterIds,
    actionDescription,
    shot,
    outfitByCharacter,
  }) => {
    const store = loadStore();
    const comic = store.get(comicId);
    if (!comic) {
      return { isError: true, content: [{ type: "text", text: `Comic "${comicId}" not found.` }] };
    }

    const result = buildPanelPrompt(comic, pageId, panelIndex, {
      target: target ?? "generic",
      backgroundId,
      characterIds,
      actionDescription,
      shot,
      outfitByCharacter,
    });

    if (!result.parts.actionDescription) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Action description must be provided explicitly or attached to the panel scene.",
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
);

// Tool 10: Set Panel Scene (Attach scene continuity metadata to a panel)
server.tool(
  "set_panel_scene",
  "Attach story bible scene continuity metadata (characters, location, camera shot, action) to a panel",
  {
    comicId: z.string().describe("ID of the comic"),
    pageId: z.string().describe("ID of the page containing the panel"),
    panelIndex: z.number().int().min(0).describe("0-based index of the panel on the page"),
    characterIds: z
      .array(z.string())
      .optional()
      .describe("IDs of characters appearing in this panel"),
    backgroundId: z
      .string()
      .optional()
      .describe("ID of the background/location where this panel takes place"),
    shot: z
      .enum([
        "establishing",
        "wide",
        "medium",
        "close-up",
        "extreme-close-up",
        "low-angle",
        "high-angle",
        "over-shoulder",
        "dutch",
      ])
      .optional()
      .describe("Camera shot angle/framing"),
    action: z.string().optional().describe("Description of action happening in this panel"),
    outfitByCharacter: z
      .record(z.string(), z.string())
      .optional()
      .describe("Map of characterId to outfitId for this panel"),
  },
  async ({
    comicId,
    pageId,
    panelIndex,
    characterIds,
    backgroundId,
    shot,
    action,
    outfitByCharacter,
  }) => {
    return mutateStore((store) => {
      const comic = store.get(comicId);
      if (!comic) {
        return {
          isError: true,
          content: [{ type: "text", text: `Comic "${comicId}" not found.` }],
        };
      }
      const page = comic.pages.find((p) => p.id === pageId);
      if (!page) {
        return {
          isError: true,
          content: [{ type: "text", text: `Page "${pageId}" not found in comic "${comicId}".` }],
        };
      }
      if (panelIndex < 0 || panelIndex >= page.panels.length) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Panel index ${panelIndex} is out of bounds (0-${page.panels.length - 1}).`,
            },
          ],
        };
      }

      const panel = page.panels[panelIndex];
      const existingScene = panel.scene ?? {};
      panel.scene = {
        ...existingScene,
        ...(characterIds !== undefined && { characterIds }),
        ...(backgroundId !== undefined && { backgroundId }),
        ...(shot !== undefined && { shot }),
        ...(action !== undefined && { action }),
        ...(outfitByCharacter !== undefined && { outfitByCharacter }),
      };

      comic.updatedAt = Date.now();

      return {
        content: [
          {
            type: "text",
            text: `Updated scene metadata for panel ${panelIndex + 1} on page "${pageId}".`,
          },
        ],
      };
    });
  },
);

// Tool 11: Get Reference Image (Returns visual model sheet as MCP image content)
server.tool(
  "get_reference_image",
  "Fetch the visual reference image for a character model sheet or background location as an MCP image",
  {
    comicId: z.string().describe("ID of the comic"),
    kind: z
      .enum(["character", "background"])
      .describe("Whether retrieving a character portrait or background location image"),
    id: z
      .string()
      .describe("Identifier of the character or background (e.g. 'elena' or 'neon_alley')"),
  },
  async ({ comicId, kind, id }) => {
    const store = loadStore();
    const comic = store.get(comicId);
    if (!comic) {
      return { isError: true, content: [{ type: "text", text: `Comic "${comicId}" not found.` }] };
    }

    const ctx = comic.assetContext ?? {};
    const ref = kind === "character" ? ctx.characters?.[id] : ctx.backgrounds?.[id];
    if (!ref) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `${kind === "character" ? "Character" : "Background"} reference "${id}" not found in comic "${comic.title}".`,
          },
        ],
      };
    }

    const imageRef = ref.imageRef;
    if (!imageRef) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `No reference image attached to ${kind} "${ref.name}" (ID: ${id}).`,
          },
        ],
      };
    }

    const mimeMap: Record<string, string> = {
      ".webp": "image/webp",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".svg": "image/svg+xml",
    };

    // 1. asset: scheme (stored on disk in .inkframe/assets/)
    if (imageRef.startsWith("asset:")) {
      const assetId = imageRef.slice(6);
      const assetsDir = path.resolve(process.cwd(), ".inkframe/assets");
      if (fs.existsSync(assetsDir)) {
        const files = fs.readdirSync(assetsDir);
        const matched = files.find((f) => f === assetId || f.startsWith(`${assetId}.`));
        if (matched) {
          const filePath = path.join(assetsDir, matched);
          const buffer = fs.readFileSync(filePath);
          const ext = path.extname(matched).toLowerCase();
          const mime = mimeMap[ext] ?? "image/webp";
          return {
            content: [
              {
                type: "image",
                data: buffer.toString("base64"),
                mimeType: mime,
              },
            ],
          };
        }
      }
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Asset file "${assetId}" was not found in .inkframe/assets directory.`,
          },
        ],
      };
    }

    // 2. data: URI scheme
    if (imageRef.startsWith("data:")) {
      const match = imageRef.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        return {
          content: [
            {
              type: "image",
              data: match[2],
              mimeType: match[1],
            },
          ],
        };
      }
    }

    // 3. url: scheme pointing to public/ demo assets
    if (imageRef.startsWith("url:")) {
      const publicPath = path.resolve(
        process.cwd(),
        "public",
        imageRef.slice(4).replace(/^\//, ""),
      );
      if (fs.existsSync(publicPath)) {
        const buffer = fs.readFileSync(publicPath);
        const ext = path.extname(publicPath).toLowerCase();
        const mime = mimeMap[ext] ?? "image/jpeg";
        return {
          content: [
            {
              type: "image",
              data: buffer.toString("base64"),
              mimeType: mime,
            },
          ],
        };
      }
    }

    // 4. idb: scheme (in browser IndexedDB only)
    if (imageRef.startsWith("idb:")) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Reference image "${imageRef}" is stored in local browser IndexedDB only. Open the Story Bible in the web editor while running npm run dev to sync reference images with the MCP server.`,
          },
        ],
      };
    }

    return {
      isError: true,
      content: [{ type: "text", text: `Unsupported image reference: "${imageRef}".` }],
    };
  },
);

// Start the MCP server over stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("MCP Server Error:", error);
  process.exit(1);
});
