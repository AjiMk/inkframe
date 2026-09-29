# Inkframe

**Inkframe** is a modern, high-performance Web application and AI-assisted studio designed for turning photos, illustrations, and video stills into structured graphic novels, comics, and storyboards.

---

## Features

### 🎨 Interactive Studio Canvas Editor
- **Dynamic Layout Templates**: Choose from standard panel layouts (*Splash*, *Stack*, *Split*, *Strip*, *Grid*, *Spotlight*, *Wide Top/Bottom*).
- **Drag & Drop Media**: Assign images directly onto panel target slots.
- **Custom Comic Dialogue**: Add and style **Speech**, **Thought**, **Shout**, and **Caption** balloons with adjustable tail pointers.
- **Ink Filters**: Apply real-time visual effects including *Noir*, *Wash*, *Halftone*, and *Newsprint*.

### 📖 Cover Designer & Typography
- **Custom Comic Covers**: Full control over issue titles, subtitles, taglines, issue numbers, price badges, and publisher branding.
- **Visual Canvas Preview**: Real-time rendering of cover templates with dynamic element positioning.

### 🎥 Video Frame Capture & Scheduled Auto-Extraction
- **Multi-Frame Video Timeline**: Upload custom video clips (or use built-in demo clips) to scrub through timestamps and pick exact freeze-frames.
- **Scheduled Extraction**: Automatically sample video frames at custom intervals (e.g., 1 frame every 5s, 10s, or 15s).

### 🤖 Model Context Protocol (MCP) Server Integration
- **AI-Driven Comic Generation**: Includes a built-in Model Context Protocol (MCP) server that enables AI agents (Claude Desktop, Cursor, Antigravity) to inspect, create, and modify comics programmatically.
- **MCP Tool Suite**: Exposes tools for adding pages, updating cover configs, switching layouts, inserting speech bubbles, applying filters, and retrieving panel prompts.

### 📄 PDF Export & Reader Modes
- **PDF Export**: Export your complete graphic novel to high-quality PDF files for printing or digital distribution.
- **Guided Panel Reader**: Step through individual comic panels sequentially with smooth focus zoom and pan transitions.
- **3D Flip Reader**: Experience realistic 3D book-flipping animations for full-page comic reading.

### 💾 Local-First Storage & Sidebar Page Management
- **Page Drag-and-Drop**: Easily reorder pages in the studio sidebar by dragging page thumbnails.
- **Offline & Instant**: Persistence via `localStorage` and IndexedDB.
- **Bundled Demo Comic**: Includes the sample graphic novel *"Night Bus 42"* ready to read or edit.

---

## Tech Stack

- **Framework**: React 19, TanStack Start & TanStack Router
- **Build & Server Engine**: Vite 8, Nitro
- **Styling & Components**: Tailwind CSS v4, Radix UI primitives, Lucide React icons
- **State Management**: Zustand
- **Database & Auth**: PGlite (PostgreSQL in WebAssembly), Better Auth
- **AI Integration**: Model Context Protocol (`@modelcontextprotocol/sdk`)
- **Export & Rendering**: jsPDF, HTML2Canvas, Web Canvas API, CSS 3D Transforms

---

## Quick Start

### 1. Prerequisites & Installation

Ensure you have **Node.js 18+** installed:

```bash
git clone https://github.com/AjiMk/inkframe.git
cd inkframe
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

The application will start locally on `http://localhost:8080`.

### 3. Run MCP Server (Optional)

To start the Model Context Protocol server for AI agent connectivity:

```bash
npm run mcp
```

### 4. Build & Typecheck

```bash
# Run TypeScript type safety check
npm run typecheck

# Build production bundle
npm run build
```

---

## Model Context Protocol (MCP) Configuration

To connect Inkframe to AI tools like Claude Desktop or Cursor, configure `mcp.json` with the following settings:

```json
{
  "mcpServers": {
    "inkframe": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/path/to/inkframe"
    }
  }
}
```

### Available MCP Tools

- `list_comics`: List all comics in the workspace.
- `create_comic`: Create a new comic project.
- `get_comic`: Fetch complete state and panels for a comic.
- `add_page`: Add a new page with a specified layout.
- `set_page_layout`: Change layout for an existing page.
- `add_dialogue`: Insert speech/thought/shout bubbles into a panel.
- `update_cover_config`: Update title, tagline, price, and cover styling.
- `apply_panel_filter`: Apply filters (*Noir*, *Wash*, *Halftone*, etc.) to a panel.
- `set_comic_references`: Define character and background asset context.
- `get_panel_prompt`: Generate AI image generation prompts for comic panels.

---

## Project Structure

```
inkframe/
├── public/                # Static assets, mcp_comics.json & demo comic imagery
├── scripts/               # Migration and app environment scripts
├── server/                # Server middleware & backend API handlers
├── src/
│   ├── components/
│   │   ├── comic/         # Studio editor, canvas, cover designer, video capture, reader
│   │   └── ui/            # Radix UI styled design primitives
│   ├── lib/
│   │   ├── app-data/      # IndexedDB and demo dataset initialization
│   │   ├── auth/          # Better Auth and session management
│   │   └── comics/        # Layout definitions, comic stores, PDF export, factory
│   ├── mcp/               # Model Context Protocol (MCP) server implementation
│   └── routes/            # TanStack file-based route handlers
├── mcp.json               # MCP server configuration
└── README.md
```

---

## Contributing & Branching Strategy

Inkframe follows a Trunk-Based / GitHub-Flow branching strategy with Conventional Commits. For detailed branch naming rules, PR workflows, and code guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

Private repository. All rights reserved.
