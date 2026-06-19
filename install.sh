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

# 3. Absolutize hooks.json. The bundled hooks.json ships RELATIVE
# `./dist/hooks/*.js` commands, which Windsurf would resolve against the project
# cwd (not this bundle) — so they would no-op exactly the way the Cursor hooks
# did before the fix. Rewrite each command to an absolute path against this
# install location so the manifest is correct whenever Windsurf runs it. (node
# is guaranteed present — checked above.)
HOOKS_JSON="$BUNDLE_DIR/hooks.json"
if [ -f "$HOOKS_JSON" ] && node -e '
  const fs=require("fs"),path=require("path");
  const f=process.argv[1], base=process.argv[2];
  const cfg=JSON.parse(fs.readFileSync(f,"utf8"));
  const re=/(?:\.\/)?dist[/\\]hooks[/\\]([A-Za-z0-9_.-]+\.js)/;
  for(const arr of Object.values(cfg.hooks||{})){
    if(!Array.isArray(arr))continue;
    for(const e of arr){
      const m=(e&&e.command||"").match(re);
      if(m) e.command=`node "${path.join(base,"dist","hooks",m[1])}"`;
    }
  }
  fs.writeFileSync(f, JSON.stringify(cfg,null,2)+"\n");
' "$HOOKS_JSON" "$BUNDLE_DIR" 2>/dev/null; then
  echo "→ hooks.json paths absolutized → $HOOKS_JSON"
else
  echo "⚠  could not absolutize hooks.json — its hook commands stay relative and may no-op."
fi

cat <<EOF

✅ Memlin CLI installed for Windsurf.

Still manual (per Windsurf's config-location rules):
  • MCP:   add mcp_config.json (hosted serverUrl) to Windsurf.
  • Rules: copy .windsurfrules into your project root.
  • Hooks: install hooks.json (now absolute-pathed) + dist/ per Windsurf's hook
           rules. Windsurf hook support is provisional; resolve also works via
           .windsurfrules + the MCP tools regardless.
EOF
