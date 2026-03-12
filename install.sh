#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/.claude/skills/share"

echo "Installing cc-cowork /share skill..."

# Create destination
mkdir -p "$DEST/scripts"

# Copy skill files
cp "$SCRIPT_DIR/skills/share/SKILL.md" "$DEST/SKILL.md"
cp "$SCRIPT_DIR/skills/share/scripts/share.mjs" "$DEST/scripts/share.mjs"

echo "Installed to $DEST"
echo "Restart Claude Code to use /share"
