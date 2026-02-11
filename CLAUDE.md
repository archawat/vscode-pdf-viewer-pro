# PDF Viewer Pro

VS Code extension for viewing PDFs with navigation, zoom, image export, and password support.

## Stack

- TypeScript + webpack
- PDF.js 3.11.174 (CDN)
- VS Code Custom Editor API (`CustomReadonlyEditorProvider`)

## Project Structure

```
src/
  extension.ts          — extension entry point, registers commands
  pdfViewerProvider.ts  — custom editor provider, handles webview messaging
  pdfRenderer.ts        — reads PDF file and returns base64 data
  pdfCache.ts           — LRU cache for PDF data
media/
  main.js               — webview client script (PDF.js rendering, UI logic)
  styles.css            — webview styles
```

## Build & Run

```bash
pnpm install              # install dependencies
pnpm run compile          # build with webpack
pnpm run watch            # build + watch
pnpm run build            # production build + package .vsix
pnpm run build-install    # build + install extension locally
```

## Documentation

Entry point: [docs/README.md](docs/README.md)

| File | Description |
|------|-------------|
| [docs/progress.md](docs/progress.md) | What works and what can improve |
| [README.md](README.md) | Project overview, features, and usage guide |

### Documentation Rules

1. **Read before building** — Before adding a new feature, read the relevant docs to understand existing behavior and conventions.
2. **Update after building** — When a feature is added or changed, update the corresponding doc file. If no doc exists, create a new file in `docs/`.
3. **Keep docs/README.md in sync** — When adding a new doc file, add an entry to `docs/README.md`.
4. **Split long content** — If a doc grows beyond ~200 lines, split it into its own file and link from `docs/README.md`.
5. **Update progress** — When finishing a feature or finding new gaps, update `docs/progress.md`.
