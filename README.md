# Inkframe

**Inkframe** is a modern, high-performance Web application designed for turning photos, illustrations, and video stills into structured graphic novels, comics, and storyboards.

---

## Features

### Video Frame Capture & Scheduled Auto-Extraction
- **Multi-Frame Video Timeline**: Upload custom video clips (or use the built-in demo video) to scrub through timestamps and pick exact freeze-frames.
- **Scheduled Extraction**: Automatically sample video frames at custom intervals (e.g. 1 frame every 5s, 10s, or 15s).

### Combined Media Library & Batch Layouts
- **Unified Media Selection**: Select both freshly captured video stills and existing comic library images simultaneously.
- **Batch Layout Generation**: Automatically populate new pages using preset panel grids (**Split**, **Grid**, **Stack**, **Strip**).

### Interactive Studio Canvas Editor
- **Dynamic Layout Templates**: Choose from standard panel layouts (*Splash*, *Stack*, *Split*, *Strip*, *Grid*, *Spotlight*, *Wide Top/Bottom*).
- **Drag & Drop Media**: Assign images directly onto panel target slots.
- **Custom Comic Elements**: Add and style **Speech**, **Thought**, **Shout**, and **Caption** balloons with adjustable tail pointers.
- **Ink Filters**: Apply real-time visual effects including *Noir*, *Wash*, *Halftone*, and *Newsprint*.

### Page Reordering & Sidebar Management
- **HTML5 Drag-and-Drop**: Easily reorder pages in the studio sidebar by dragging page thumbnails.
- **Page Sorting Controls**: Quickly sort slides ascending or descending by page index.
- **Sticky Workspace Viewport**: Keeps controls accessible while allowing smooth scrolling through scenes.

### Immersive Reader Modes
- **Guided Reader**: Step through individual comic panels sequentially with smooth focus zoom and pan transitions.
- **3D Flip Reader**: Experience realistic 3D book-flipping animations for full-page comic reading.

### Local-First Storage
- **Offline & Instant**: Persistence via `localStorage` and IndexedDB.
- **Bundled Demo Comic**: Includes the sample graphic novel *"Night Bus 42"* ready to read or edit.

---

## Tech Stack

- **Framework**: React 19, TanStack Start & TanStack Router
- **Build System**: Vite 8, Nitro
- **Styling**: Tailwind CSS v4, Radix UI primitives, Lucide React icons
- **State Management**: Zustand
- **Graphics & Video**: Web Canvas API, HTML5 Video, CSS 3D Transforms

---

## Quick Start

### 1. Installation

Ensure you have **Node.js 18+** installed:

```bash
git clone https://github.com/your-username/inkframe.git
cd inkframe
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

The application will start locally on `http://localhost:8080`.

### 3. Build & Typecheck

```bash
# Run TypeScript type safety check
npm run typecheck

# Build production bundle
npm run build
```

---

## Project Structure

```
inkframe/
├── public/                # Static assets & demo comic imagery
├── scripts/               # Build environment and dev PWA helpers
├── src/
│   ├── components/
│   │   ├── comic/         # Studio editor, canvas, video capture dialog, reader
│   │   └── ui/            # Radix UI styled design primitives
│   ├── lib/
│   │   ├── app-data/      # IndexedDB and demo dataset initialization
│   │   └── comics/        # Layout definitions, comic stores, and types
│   └── routes/            # TanStack file-based route handlers
└── README.md
```

---

## Contributing & Branching Strategy

InkFrame follows a Trunk-Based / GitHub-Flow branching strategy with Conventional Commits. For detailed branch naming rules, PR workflows, and GitHub protection guidelines, see [CONTRIBUTING.md](file:///home/aji/Projects/inkframe/CONTRIBUTING.md).

---

## License

Private repository. All rights reserved.
