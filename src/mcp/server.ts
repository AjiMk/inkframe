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
    const assetContext = comic?.assetContext ?? {
      styleGuide: "Default clean comic book style",
      backgrounds: {},
      characters: {},
    };
    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(assetContext, null, 2),
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
  },
  async ({ comicId, pageId, panelIndex, kind, text }) => {
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

      const bubble = createBubble(kind as BubbleKind, text);
      panel.bubbles.push(bubble);
      comic.updatedAt = Date.now();

      return {
        content: [
          {
            type: "text",
            text: `Added ${kind} bubble ("${bubble.text}") to Panel ${panelIndex + 1} on Page ${pageId}.`,
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
            .describe("Detailed model sheet (age, height, complexion, hairstyle, clothing)"),
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
      .describe("Detailed description of action/scene in this specific panel"),
  },
  async ({ comicId, backgroundId, characterIds, actionDescription }) => {
    const store = loadStore();
    const comic = store.get(comicId);
    if (!comic) {
      return { isError: true, content: [{ type: "text", text: `Comic "${comicId}" not found.` }] };
    }

    const ctx = comic.assetContext ?? {};
    const promptParts: string[] = [];

    if (ctx.styleGuide) {
      promptParts.push(`[ART STYLE]: ${ctx.styleGuide}`);
    }

    if (backgroundId && ctx.backgrounds?.[backgroundId]) {
      const bg = ctx.backgrounds[backgroundId];
      promptParts.push(`[SETTING (${bg.name})]: ${bg.description}`);
    }

    if (characterIds && characterIds.length > 0 && ctx.characters) {
      const charSpecs = characterIds
        .map((id) => ctx.characters?.[id])
        .filter((c): c is NonNullable<typeof c> => Boolean(c))
        .map((c) => `${c.name} (${c.appearance})`)
        .join("; ");

      if (charSpecs) {
        promptParts.push(`[CHARACTERS]: ${charSpecs}`);
      }
    }

    promptParts.push(`[SCENE ACTION]: ${actionDescription}`);
    const compiledPrompt = promptParts.join("\n");

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              comicId,
              compiledPrompt,
              parts: {
                styleGuide: ctx.styleGuide,
                background: backgroundId ? ctx.backgrounds?.[backgroundId] : null,
                characters: characterIds?.map((id) => ctx.characters?.[id]).filter(Boolean),
                actionDescription,
              },
            },
            null,
            2,
          ),
        },
      ],
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
