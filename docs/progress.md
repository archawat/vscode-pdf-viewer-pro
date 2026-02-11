# Progress

## What works

**PDF Viewer Pro** — VS Code extension for viewing and exporting PDFs

Stack: TypeScript, webpack, PDF.js (bundled), VS Code Custom Editor API

### User-facing

- PDF rendering — opens any PDF in a custom editor tab
- Page navigation — arrow keys, PageUp/PageDown, toolbar buttons
- Zoom — 10% increments from 10% to 500%, default 70%
- Image export — single page or all pages, PNG or JPEG with quality control
- Password-protected PDFs — overlay dialog with retry on wrong password
- Persistent settings — remembers format/quality choices across files
- HiDPI rendering — sharp display on Retina/high-DPI screens
- Keyboard shortcuts — full keyboard navigation without mouse
- Text selection — select and copy text from PDFs via text layer overlay
- Search — Ctrl+F to find text across all pages with match highlighting and navigation
- Print — opens PDF in system viewer for printing (button or Ctrl+P)
- Offline support — PDF.js bundled locally, no internet required

### Technical

- PDF.js 3.11.174 bundled in media/vendor/ (copied from pdfjs-dist at build time)
- LRU cache for PDF data (capacity 100)
- Canvas-based rendering with devicePixelRatio scaling
- Text layer overlay using pdfjsLib.renderTextLayer() for selection
- Search extracts text from all pages, highlights matches with VS Code theme colors
- Export always renders at 100% scale regardless of zoom
- ArrayBuffer copied before passing to worker to prevent detach errors

## Can improve

- No tests — everything tested by hand
- No continuous scroll mode — page-by-page only
- No bookmark or outline/TOC support
- No drag-to-pan when zoomed in
- No dark mode inversion for PDFs with white backgrounds
