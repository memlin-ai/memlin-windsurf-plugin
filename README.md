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
- **Hooks:** `pre_user_prompt` runs session-start once per trajectory (plan
  sync, handoff auto-accept, heartbeat); guardrails for writes, commands, and
  MCP calls; plan sync after writes; and turn capture from Windsurf's
  documented Cascade hook events.

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


## Feature and workstream context

Feature commands use the project resolved for the current workspace and its owning account. Pass `--project <uuid>` for an explicit project. Lists default to active and shipped; use complete IDs from the JSON output.

- `memlin features list [--status proposed,active,shipped,archived]`
- `memlin features search "query" [--status active,shipped]`
- `memlin features show <feature-id>` — visible members, linked work, noun and bounded progress counts.
- `memlin features create "title" [--summary "summary"]`
- `memlin features status <feature-id> <status>` — legal transitions only.
- `memlin features rename <feature-id> "title" [--summary "summary"]`
- `memlin features add <feature-id> <kind> <member-id>`
- `memlin features remove <feature-id> <link-id>` — use a membership `id` from `show`, not the source item ID. Removing an automatic document link prevents automatic relinking.

Member kinds: thought, file, todo, plan, goal, memory, skill, schema, decision, component and work_item. Binary attachments use Files; they are not feature member kinds.

MCP equivalents: `memlin_list_features`, `memlin_get_feature`, `memlin_create_feature`, `memlin_update_feature`, `memlin_add_to_feature`, `memlin_remove_from_feature`. Find an existing feature before creating one; duplicate errors include its ID. A feature in `bundle.feature_context`, when present, can supply the current feature ID.

Readers can list and inspect. Changes require current writer access and enabled project tracking. Rename/re-summary requires a human JWT; service-token shipping is disabled by default. These tools are outside Memlin Light. Search falls back to title matching when AI is unavailable.

### Keep captures with the current feature

Use `memlin features pin <feature-id>` on the working branch. When `MEMLIN_SESSION_ID` is available, the pin also follows that session. Use `memlin features pin --clear` to remove that pin. Default branches are rejected. Session notes, proposed memories, commit notes and new plans carry the binding as a hint; the server checks current access and project tracking before filing anything.

Pins, accepted handoffs and branch bindings can be cached locally for the exact account, project and session. Semantic suggestions are temporary. Automatically captured associations remain server-resolved through the session or branch and are not promoted into a local explicit feature hint.
