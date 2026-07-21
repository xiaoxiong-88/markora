# Markora

A local-first, privacy-friendly Markdown desktop editor. Free, fast, refined — an experience as close to Typora as possible.

> This repository was created on 2026-07-21.

## Features

- **Dual editor architecture**: WYSIWYG (Milkdown / ProseMirror) + Source (CodeMirror 6)
- **Four edit modes**: WYSIWYG, Source, Split preview, Reading
- **Live preview**: bidirectional scroll sync via source anchors
- **Tables, task lists, footnotes, front matter, KaTeX math, Mermaid diagrams**
- **Shiki code highlighting, image paste/drag-to-assets**
- **Workspace file tree, outline, in-document + workspace search**
- **Multi-tab, auto-save, external-change detection with conflict resolution**
- **Themes (Light / Dark / Sepia / High Contrast), command palette, quick open**
- **HTML export, print/PDF, settings center, session restore, crash recovery**

## Tech stack

- **Desktop**: Tauri 2 (Rust)
- **Frontend**: React + TypeScript (strict) + Vite + Zustand + Tailwind CSS
- **Editor**: Milkdown (WYSIWYG), CodeMirror 6 (Source)
- **Markdown**: unified / remark / rehype ecosystem

## Requirements

- [Node.js](https://nodejs.org/) + [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- Tauri system dependencies: https://v2.tauri.app/start/prerequisites/

## Development

```bash
pnpm install
pnpm tauri dev
```

## Build

```bash
pnpm tauri build
```

## Test

```bash
pnpm typecheck      # TypeScript check
pnpm test           # Vitest frontend tests
cd src-tauri && cargo test  # Rust backend tests
```

## Project structure

```
markora/
├── src/                  # React frontend
├── src-tauri/            # Tauri + Rust backend
├── tests/                # Test fixtures
├── docs/                 # Documentation (ARCHITECTURE, SECURITY, DEVELOPMENT)
├── package.json
├── pnpm-lock.yaml
└── README.md
```

## Privacy

Markora is fully local-first. No telemetry, no uploads, no login, no cloud sync, no API keys. Your documents never leave your machine.

## License

MIT
