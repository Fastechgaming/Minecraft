#!/usr/bin/env bash
# One-time setup: downloads Lavalink.jar if it's missing. Run this once before
# starting the "lavalink" PM2 app for the first time (see README's Music section).
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v java >/dev/null 2>&1; then
  echo "Java is not installed. Lavalink needs a Java 17+ runtime."
  echo "On Ubuntu/Debian: sudo apt update && sudo apt install -y openjdk-17-jre-headless"
  exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -n1 | grep -oE '[0-9]+' | head -n1)
if [ "$JAVA_VERSION" -lt 17 ]; then
  echo "Found Java $JAVA_VERSION, but Lavalink needs Java 17 or newer."
  echo "On Ubuntu/Debian: sudo apt update && sudo apt install -y openjdk-17-jre-headless"
  exit 1
fi

if [ -f lavalink/Lavalink.jar ]; then
  echo "lavalink/Lavalink.jar already present — leaving it as-is (delete it manually to force a re-download)."
else
  echo "Downloading Lavalink.jar..."
  curl -fL -o lavalink/Lavalink.jar https://github.com/lavalink-devs/Lavalink/releases/latest/download/Lavalink.jar
  echo "Downloaded to lavalink/Lavalink.jar"
fi

echo "Done. Start it with: pm2 start ecosystem.config.js --only lavalink"
