# LENS LAB dependency and runtime policy

The Windows launcher checks Node.js before package installation. The dependency set is pinned to exact package versions in `package.json`. The launcher compares the root project version in an existing `package-lock.json` with `package.json` before deciding whether it can reuse the lockfile. If the project version changed, it uses `npm install` to reconcile the lockfile while retaining already installed packages; if the lockfile matches but dependencies are inconsistent, it uses `npm ci`. If the lockfile is missing, it runs `npm install` to create it. When dependencies and an existing lockfile are compatible, it skips installation. It then verifies the direct dependency tree with `npm ls --depth=0` and runs `npm run verify`.

## Runtime

- Node.js 22.12+ (22.x), 24.x, or 26.x LTS.
- npm supplied by the Node.js distribution.
- Windows 10/11 for the one-click `LENS-LAB.cmd` launcher.
- At least 1 GB available disk space for first installation and build.
- Current Chromium, Firefox, or Safari-family browser with Canvas, Blob URLs, and IndexedDB support.

Vite 8 and Vitest 5 require a modern Node runtime. Use a supported LTS release instead of an odd-numbered Current/experimental release. The installer retrieves LTS release metadata from the official Node.js distribution site and verifies a downloaded MSI against the official SHA-256 manifest.

## Pinned application package versions

These exact direct dependency versions are defined in `package.json` for this release:

| Package | Pinned version |
|---|---:|
| `react`, `react-dom` | 19.3.1 |
| `zustand` | 5.1.0 |
| `lucide-react` | 1.70.0 |
| `vite` | 8.3.6 |
| `@vitejs/plugin-react` | 6.2.1 |
| `typescript` | 7.0.2 |
| `vitest` | 5.1.0 |
| `@types/node` | 26.6.6 |
| `@types/react`, `@types/react-dom` | 19.3.0 |

| Package | Role |
|---|---|
| `react`, `react-dom` | UI and component lifecycle |
| `zustand` | Lightweight application state |
| `lucide-react` | Interface icons |
| `vite`, `@vitejs/plugin-react` | Development server and production build |
| `typescript` | Static type checking |
| `vitest` | Unit testing |
| `@types/node`, `@types/react`, `@types/react-dom` | Type definitions |

No server framework, cloud client, image-upload SDK, Three.js or heavyweight state library is included. Canvas 2D, browser APIs and a few local utilities cover the initial use case.

## Verification commands

```bash
npm ls --depth=0
npm run typecheck
npm test
npm run build
npm run verify
```

`npm run verify` runs type checking, unit tests, and a production Vite build. The launcher uses this verification command before it starts the optimized production preview server.

## Fallback policy

- IndexedDB unavailable → capture/preset/log operations fall back to session memory when possible; the UI distinguishes non-persistent saves. Persistent browser diagnostics are capped at the most recent 2,000 entries to prevent unbounded growth.
- LocalStorage unavailable → preferences/guide dismissal remain usable for the current session where app state allows; persistent one-time behavior cannot be guaranteed without browser storage.
- Worker, `createImageBitmap`, or `OffscreenCanvas` unavailable or failing → use the main-thread Canvas 2D renderer. Full-resolution exports use the Canvas path.
- Canvas context unavailable → Photo Lab displays a processing error while retaining the original preview; the rest of the application remains usable.
- Web Crypto unavailable → image fingerprinting is marked unavailable; recipes remain usable without a fingerprint.
- EXIF tags absent or unsupported → metadata fields remain blank; the application never invents camera metadata.
- Batch archive output too large → stop before exceeding the 150 MB combined-output limit and report the reason.
- Image decode failure → reject the file and preserve the currently loaded image.
- Optional animation/sound disabled or unsupported → core simulation remains functional.
