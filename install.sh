#!/usr/bin/env bash
# Memlin → Windsurf installer (self-contained bundle).
#
# Usage:  bash install.sh
#
# Installs the `memlin` CLI launcher on PATH (the bundled dist/cli/main.js) and
# signs you in. The MCP server, .windsurfrules, and hooks.json are added per
# Windsurf's own config-location rules — see README.md.
set -euo pipefail

BUNDLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Memlin → Windsurf installer"
echo "bundle: $BUNDLE_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "✗ 'node' is required (≥ 18). Install from https://nodejs.org" >&2
  exit 1
fi

# 1. Provision the `memlin` launcher on PATH.
BIN_DIR="$HOME/.local/bin"
mkdir -p "$BIN_DIR"
printf '#!/bin/sh\nexec node "%s" "$@"\n' "$BUNDLE_DIR/dist/cli/main.js" > "$BIN_DIR/memlin"
chmod +x "$BIN_DIR/memlin"
echo "→ memlin launcher: $BIN_DIR/memlin"
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) echo "⚠  $BIN_DIR is not on your PATH — add it (e.g. export PATH=\"\$HOME/.local/bin:\$PATH\") so 'memlin' resolves in new terminals." ;;
esac

# 2. Sign in (if not already).
TOKEN_FILE="$HOME/.config/memlin/token.json"
if [ -s "$TOKEN_FILE" ]; then
  echo "→ already signed in ✓"
else
  echo ""
  echo "→ Signing in to Memlin..."
  node "$BUNDLE_DIR/dist/cli/login.js" || {
    echo ""
    echo "⚠  Sign-in skipped. Run this later:"
    echo "   node \"$BUNDLE_DIR/dist/cli/login.js\""
  }
fi

cat <<EOF

✅ Memlin CLI installed for Windsurf.

Still manual (per Windsurf's config-location rules):
  • MCP:   add mcp_config.json (hosted serverUrl) to Windsurf.
  • Rules: copy .windsurfrules into your project root.
  • Hooks: install hooks.json + dist/ per Windsurf's hook rules.
EOF
