# @memlin/windsurf-plugin

The Memlin integration surface for Windsurf. It brings Windsurf to the same
Memlin contract used by the other adapters where the host platform allows it:
MCP tools, persistent agent instructions, CLI-driven workspace operations, and
manual scribe/sync commands.

## What it ships

| File                            | Windsurf surface                           |
| ------------------------------- | ------------------------------------------ |
| `mcp_config.json`               | local stdio MCP server config (token.json) |
| `dist/mcp-server.js`            | the bundled local MCP server (no OAuth)    |
| `.windsurfrules`                | always-on Memlin resolver guidance         |
| `hooks.json` + `src/hooks/*.ts` | documented Cascade lifecycle hooks         |
| `package.json`                  | adapter version source for install health  |

## Capability coverage

- **MCP tools:** full. Use `memlin_resolve_task`, `memlin_search`,
  `memlin_read_memory`, and `memlin_get_document`.
- **Rules:** full. Copy `.windsurfrules` into the project root.
- **Commands:** via the `memlin` CLI (`memlin status`, `memlin sync`,
  `memlin ask`, `memlin scribe`, etc.).
- **Sync:** via the `memlin` CLI.
- **Scribe:** automatic through `post_cascade_response_with_transcript`; manual
  via `memlin scribe` otherwise.
- **Hooks:** guardrails for writes, commands, and MCP calls; plan sync after
  writes; and turn capture from Windsurf's documented Cascade hook events.

## Install

From the published bundle (recommended — prebuilt, no monorepo needed):

1. Get the bundle: `git clone https://github.com/memlin-ai/memlin-windsurf-plugin`
   (auto-published from this app by `scripts/build-windsurf-plugin.sh`; hooks
   and the `memlin` CLI arrive prebuilt under `dist/`).
2. Run `bash install.sh` — provisions the `memlin` CLI launcher on PATH, signs
   you in (writing `~/.config/memlin/token.json`), and installs the local MCP
   server into `~/.codeium/windsurf/mcp_config.json` (merge-safe). The bundled
   CLI is `dist/cli/main.js`; the installer does NOT rely on a published npm
   package.
3. Copy `.windsurfrules` into the project root.
4. Install `hooks.json` + `dist/` according to Windsurf's hook-location rules.
5. Reload Windsurf, then verify with `memlin_search` or `memlin_resolve_task`.

The MCP server runs locally (`node dist/mcp-server.js`) and authenticates with
the `token.json` written by sign-in — no hosted `serverUrl`, no browser OAuth.

From source (this monorepo): build hooks with
`pnpm --filter @memlin/windsurf-plugin build`, then follow steps 2–6.

Windsurf does not provide a prompt hook that can inject model context, so the
always-on rule tells Cascade to call `memlin_resolve_task` before non-trivial
work. Hook entrypoints remain fail-open on malformed or future payloads.
