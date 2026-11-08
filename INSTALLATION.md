# LENS LAB 0.5.1 — Installation

## Windows — one file to launch

Extract the complete ZIP archive to a writable folder and double-click **`LENS-LAB.cmd`**. Do not manually open the PowerShell helper. The CMD file calls the launcher, which:

1. Checks Windows, source files, architecture, and available disk space.
2. Checks whether Node.js/npm are already installed and compatible. If yes, it skips runtime installation.
3. If Node.js is missing, tries `winget` first; if that is unavailable or unsuitable, downloads an official LTS Windows MSI from `nodejs.org`, checks its SHA-256 against the official manifest, and runs the installer with Windows approval.
4. Checks installed npm dependencies with `npm ls --depth=0`. If `package-lock.json` is missing, it runs `npm install` even when dependencies already exist so npm creates a reproducible lockfile. If a compatible lockfile exists and the dependency tree is healthy, installation is skipped; inconsistent dependencies are repaired using `npm ci` or `npm install` as appropriate.
5. Runs `npm run verify` (TypeScript typecheck, Vitest suite, and Vite production build).
6. Chooses an available local port, starts the optimized Vite preview server, waits for the app response, opens the browser, and prints **`DONE PROCESSING`**.

Keep the launcher window open while using LENS LAB. Press Enter in that window to stop the server. You can launch it again with the same `LENS-LAB.cmd` file. The launcher writes `logs/launcher.log` and `logs/app-server.log`.

## Requirements

- Windows 10/11 for the one-click launcher.
- Node.js 22.12+ (22.x), 24.x, or 26.x LTS; npm.
- Modern browser with Canvas, Blob URL and IndexedDB support.
- At least 1 GB free disk space required for first installation and builds.
- Internet access for installing a missing Node.js runtime or missing npm dependencies.

## macOS / Linux

Install a supported Node.js LTS release and npm, extract the archive, then run:

```bash
bash scripts/install.sh
```

## Manual developer workflow

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
npm run verify
```

## Logs and troubleshooting

- `logs/launcher.log` — machine checks, runtime and dependency install decisions, verification, and launcher errors.
- `logs/app-server.log` — Vite server output.
- In the app, open Settings → Diagnostics and process log to search/export browser-side errors and events.

Read the first error near the bottom of the relevant log. The source archive intentionally omits `node_modules`. If no lockfile is present, the first successful `npm install` generates `package-lock.json`; keep that file for future reproducible installs. Dependency installation requires registry access. If the automatic Node installer cannot elevate or reach nodejs.org, install Node.js LTS manually from <https://nodejs.org/en/download> and run `LENS-LAB.cmd` again.

## Data storage

Captures, presets and browser logs use IndexedDB when available. Preferences and onboarding state use LocalStorage. Clearing browser site data may permanently remove local records; export important photographs and `.lenspreset.txt` preset files.
