#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
mkdir -p logs
exec > >(tee -a logs/launcher.log) 2>&1

echo "============================================================"
echo " LENS LAB 0.5.0 | LOCAL PHOTOGRAPHY SIMULATION STUDIO"
echo "============================================================"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js is missing. Install a supported LTS release from https://nodejs.org/en/download."
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm is missing. Repair the Node.js installation and retry."
  exit 1
fi
node -e 'const [a,b]=process.versions.node.split(".").map(Number); const ok=(a===22&&b>=12)||a===24||a===26; if(!ok){console.error("Need Node.js 22.12+, 24.x, or 26.x LTS.");process.exit(1)}'
echo "Node $(node --version) and npm $(npm --version) detected."

if npm ls --depth=0 >/dev/null 2>&1; then
  echo "Dependencies are already present; skipping installation."
else
  echo "Installing missing or inconsistent dependencies..."
  npm install --no-audit --no-fund
  npm ls --depth=0
fi

echo "Running code checks, tests, and production build..."
npm run verify

echo "DONE PROCESSING"
echo "Open http://127.0.0.1:4173 in your browser."
echo "Launcher log: $ROOT/logs/launcher.log"
echo "Server log:   $ROOT/logs/app-server.log"
npm run preview -- --host 127.0.0.1 2>&1 | tee -a logs/app-server.log
