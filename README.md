# Inkframe

A comic studio for turning photos and video stills into a readable book.

Create pages, drop images onto panels, grab frames from a clip, add speech / thought / shout / caption balloons, then read the result with guided panel zoom or a full-page flip.

## Features

- Photo upload and drag-and-drop onto panels
- Video frame capture (upload a clip or use the bundled sample)
- Speech, thought, shout, and caption balloons you can drag and resize
- Page layouts: splash, stack, split, strip, grid, wide top/bottom, spotlight
- Ink filters: wash, noir, halftone, newsprint
- Guided reader (panel-by-panel) and flip reader
- Sample comic: *Night Bus 42*
- Comics stay in the browser (`localStorage` + IndexedDB)

## Run locally

```bash
npm install
npm run dev
```

The app listens on `0.0.0.0:8080`.

```bash
npm run build
npm run typecheck
```

## Stack

React 19, TanStack Start, Tailwind v4, Zustand, Radix UI.

## License

Private repository. All rights reserved.
