#!/usr/bin/env bash
# One-command safe deploy for a bare-metal/VPS install (not Docker).
#
# `npm start` only runs the already-compiled dist/server.js — it does NOT
# rebuild automatically. Pulling new source or changing dependencies
# without rebuilding leaves dist/ executing stale, possibly-deleted code
# against a node_modules tree it no longer matches (this has caused
# "Cannot find module" and reverted-bug-fix crash loops before). This
# script always does the full sequence in the right order.
#
# Usage: ./deploy.sh   (from the project root)

set -euo pipefail
cd "$(dirname "$0")"

echo "==> Pulling latest source"
git pull

echo "==> Installing dependencies (prunes removed packages too)"
npm install

echo "==> Rebuilding (dashboard + bot) — dist/ and .next/ are now in sync with source"
rm -rf dist .next
npm run build

echo "==> Restarting with PM2"
if pm2 describe makongos > /dev/null 2>&1; then
  pm2 restart makongos
else
  pm2 start ecosystem.config.js
fi

echo "==> Done. Tailing logs (Ctrl+C to stop watching, the process keeps running):"
pm2 logs makongos --lines 30
