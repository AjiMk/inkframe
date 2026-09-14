import fs from "node:fs";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  createComic,
  createPage,
  createBubble,
  fitPanelsToLayout,
  defaultCoverConfig,
  FILTERS,
} from "../lib/comics/factory.ts";
import { LAYOUTS } from "../lib/comics/layouts.ts";
import type { Comic, PageLayoutId, BubbleKind, PanelFilter, CoverTemplateStyle } from "../lib/comics/types.ts";

const STORAGE_PATH = path.resolve(process.cwd(), "public/mcp_comics.json");

function loadStore(): Map<string, Comic> {
  const store = new Map<string, Comic>();
  try {
    if (fs.existsSync(STORAGE_PATH)) {
      const data = JSON.parse(fs.readFileSync(STORAGE_PATH, "utf-8")) as Comic[];
      for (const c of data) {
        store.set(c.id, c);
      }
    }
  } catch (err) {
    console.error("Failed to load mcp_comics.json:", err);
  }
  if (store.size === 0) {
    const sampleComic = createComic("The Midnight Falcon", "Aji Mk");
    sampleComic.coverConfig = {
      ...defaultCoverConfig(),
      tagline: "ACTION-PACKED FIRST ISSUE!",
      subtitle: "ORIGIN OF THE FALCON",
      issueNumber: "#1",
      issuePrice: "25¢",
    };
    store.set(sampleComic.id, sampleComic);
  }
  return store;
}

const comicsStore = loadStore();

function persistStore() {
  try {
    const list = Array.from(comicsStore.values());
    fs.mkdirSync(path.dirname(STORAGE_PATH), { recursive: true });
    fs.writeFileSync(STORAGE_PATH, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save mcp_comics.json:", err);
  }
}
persistStore();

const server = new McpServer({
  name: "inkframe-mcp-server",
  version: "1.0.0",
});

// --- RESOURCES ---

// Resource 1: Available page layouts
server.resource(
  "layouts",
  "inkframe://layouts",
  async (uri) => ({
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
          2
        ),
        mimeType: "application/json",
      },
    ],
  })
);

// Resource 2: Available comic filters
server.resource(
  "filters",
  "inkframe://filters",
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        text: JSON.stringify(FILTERS, null, 2),
        mimeType: "application/json",
      },
    ],
  })
);

// Resource 3: Cover templates & title styles
server.resource(
  "templates",
  "inkframe://templates",
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        text: JSON.stringify(
          {
            templates: ["classic", "action", "vintage", "pulp", "graphic-novel"],
            titleStyles: ["classic-3d", "retro-bold", "neon-glitch", "distressed-pulp"],
            bubbleKinds: [
              "speech",
              "thought",
              "shout",
              "caption",
              "sfx",
              "title-banner",
              "burst-label",
            ],
          },
          null,
          2
        ),
        mimeType: "application/json",
      },
    ],
  })
);

// --- TOOLS ---

// Tool 1: List comics
server.tool(
  "list_comics",
  "List all comics created in this session",
  {},
  async () => {
    const list = Array.from(comicsStore.values()).map((c) => ({
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
  }
);

// Tool 2: Create comic
server.tool(
  "create_comic",
  "Create a new comic book with title, author, and default cover",
  {
    title: z.string().describe("Title of the comic book"),
    author: z.string().optional().describe("Author or creator byline"),
  },
  async ({ title, author }) => {
    const comic = createComic(title, author ?? "Anonymous");
    comicsStore.set(comic.id, comic);
    persistStore();
    return {
      content: [
        {
          type: "text",
          text: `Created comic "${comic.title}" (ID: ${comic.id}) with 1 splash page.`,
        },
      ],
    };
  }
);

// Tool 3: Get comic detail
server.tool(
  "get_comic",
  "Get the full JSON structure of a comic by ID",
  {
    comicId: z.string().describe("ID of the comic to retrieve"),
  },
  async ({ comicId }) => {
    const comic = comicsStore.get(comicId);
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
  }
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
    const comic = comicsStore.get(comicId);
    if (!comic) {
      return {
        isError: true,
        content: [{ type: "text", text: `Comic "${comicId}" not found.` }],
      };
    }
    const page = createPage(layout as PageLayoutId);
    comic.pages.push(page);
    comic.updatedAt = Date.now();
    persistStore();
    return {
      content: [
        {
          type: "text",
          text: `Added Page ${comic.pages.length} (ID: ${page.id}) with layout "${layout}" (${page.panels.length} panels) to "${comic.title}".`,
        },
      ],
    };
  }
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
    const comic = comicsStore.get(comicId);
    if (!comic) {
      return { isError: true, content: [{ type: "text", text: `Comic "${comicId}" not found.` }] };
    }
    const pageIndex = comic.pages.findIndex((p) => p.id === pageId);
    if (pageIndex === -1) {
      return { isError: true, content: [{ type: "text", text: `Page "${pageId}" not found.` }] };
    }
    comic.pages[pageIndex] = fitPanelsToLayout(comic.pages[pageIndex], layout as PageLayoutId);
    comic.updatedAt = Date.now();
    persistStore();
    return {
      content: [
        {
          type: "text",
          text: `Updated Page ${pageIndex + 1} layout to "${layout}" (${comic.pages[pageIndex].panels.length} panels).`,
        },
      ],
    };
  }
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
      .enum([
        "speech",
        "thought",
        "shout",
        "caption",
        "sfx",
        "title-banner",
        "burst-label",
      ])
      .describe("Style / type of dialogue element"),
    text: z.string().optional().describe("Text content for the dialogue element"),
  },
  async ({ comicId, pageId, panelIndex, kind, text }) => {
    const comic = comicsStore.get(comicId);
    if (!comic) {
      return { isError: true, content: [{ type: "text", text: `Comic "${comicId}" not found.` }] };
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
    persistStore();

    return {
      content: [
        {
          type: "text",
          text: `Added ${kind} bubble ("${bubble.text}") to Panel ${panelIndex + 1} on Page ${pageId}.`,
        },
      ],
    };
  }
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
  async ({ comicId, template, titleStyle, tagline, subtitle, issueNumber, issuePrice, issueDate }) => {
    const comic = comicsStore.get(comicId);
    if (!comic) {
      return { isError: true, content: [{ type: "text", text: `Comic "${comicId}" not found.` }] };
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
    persistStore();

    return {
      content: [
        {
          type: "text",
          text: `Updated cover page config for "${comic.title}".`,
        },
      ],
    };
  }
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
    const comic = comicsStore.get(comicId);
    if (!comic) {
      return { isError: true, content: [{ type: "text", text: `Comic "${comicId}" not found.` }] };
    }
    const page = comic.pages.find((p) => p.id === pageId);
    if (!page) {
      return { isError: true, content: [{ type: "text", text: `Page "${pageId}" not found.` }] };
    }
    const panel = page.panels[panelIndex];
    if (!panel) {
      return { isError: true, content: [{ type: "text", text: `Panel index ${panelIndex} out of bounds.` }] };
    }

    panel.filter = filter as PanelFilter;
    comic.updatedAt = Date.now();
    persistStore();

    return {
      content: [
        {
          type: "text",
          text: `Applied "${filter}" filter to Panel ${panelIndex + 1} on Page ${pageId}.`,
        },
      ],
    };
  }
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
