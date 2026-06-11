#!/usr/bin/env node
import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);

// packages/plugin-core/src/cli/login.ts
import { promises as fs3 } from "node:fs";
import path4 from "node:path";
import os5 from "node:os";

// packages/plugin-core/src/auth.ts
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
var MEMLIN_PROD_AUTH0_DOMAIN = "memlin.us.auth0.com";
var MEMLIN_PROD_AUTH0_CLIENT_ID = "fyYMQ4Cxc6Nu5juVwL8Ihqq4fgAFecG9";
var AUTH0_DOMAIN = process.env.MEMLIN_AUTH0_DOMAIN || MEMLIN_PROD_AUTH0_DOMAIN;
var AUTH0_CLIENT_ID = process.env.MEMLIN_AUTH0_CLIENT_ID || MEMLIN_PROD_AUTH0_CLIENT_ID;
var AUTH0_AUDIENCE = process.env.MEMLIN_AUTH0_AUDIENCE ?? "https://api.memlin.ai";
var SCOPE = "openid profile email offline_access";
function tokenFilePath() {
  return process.env.MEMLIN_TOKEN_FILE || path.join(os.homedir(), ".config", "memlin", "token.json");
}
async function writePersistedToken(t) {
  const file = tokenFilePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = path.join(path.dirname(file), `token.json.tmp-${process.pid}`);
  await fs.writeFile(tmp, JSON.stringify(t, null, 2), { mode: 384 });
  await fs.chmod(tmp, 384).catch(() => {
  });
  await fs.rename(tmp, file);
}
async function startDeviceFlow() {
  requireClientId();
  const body = new URLSearchParams({
    client_id: AUTH0_CLIENT_ID,
    scope: SCOPE,
    audience: AUTH0_AUDIENCE
  });
  const res = await fetch(`https://${AUTH0_DOMAIN}/oauth/device/code`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  if (!res.ok) {
    throw new Error(`device code request ${res.status}: ${await res.text()}`);
  }
  return await res.json();
}
async function pollForToken(deviceCode, intervalSec, onTick) {
  let interval = intervalSec;
  const startedAt = Date.now();
  while (true) {
    await new Promise((r) => setTimeout(r, interval * 1e3));
    onTick?.(Math.floor((Date.now() - startedAt) / 1e3));
    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: deviceCode,
      client_id: AUTH0_CLIENT_ID
    });
    const res = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    });
    const json = await res.json();
    if (res.ok && json.access_token) {
      return toPersisted(json);
    }
    if (json.error === "authorization_pending") continue;
    if (json.error === "slow_down") {
      interval += 1;
      continue;
    }
    throw new Error(`token poll: ${json.error_description ?? json.error ?? "unknown error"}`);
  }
}
function toPersisted(json, fallbackRefresh) {
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? fallbackRefresh,
    expires_at: Date.now() + json.expires_in * 1e3
  };
}
function requireClientId() {
  if (!AUTH0_CLIENT_ID) {
    throw new Error(
      "Auth0 client id not configured. Set MEMLIN_AUTH0_CLIENT_ID env var (and optionally MEMLIN_AUTH0_DOMAIN / MEMLIN_AUTH0_AUDIENCE for self-hosted setups)."
    );
  }
}

// packages/plugin-core/src/memlin-api-client.ts
import os3 from "node:os";

// packages/plugin-core/src/runtime-shared.ts
var AGENT_KIND_HEADER = "Memlin-Agent-Kind";
var AGENT_DEVICE_HEADER = "Memlin-Agent-Device";
var AGENT_VERSION_HEADER = "Memlin-Agent-Version";
var AGENT_CAPABILITIES_HEADER = "Memlin-Agent-Capabilities";
var AGENT_EXPECTED_CAPABILITIES = {
  "claude-code": ["cli", "commands", "hooks", "sync", "scribe", "resolve"],
  cursor: ["mcp", "commands", "hooks", "rules", "scribe", "resolve"],
  codex: ["mcp", "cli", "hooks", "rules", "scribe", "resolve"],
  windsurf: ["mcp", "cli", "hooks", "rules", "scribe", "resolve"],
  gemini: ["mcp", "rules", "resolve"],
  grok: ["mcp", "rules", "resolve"],
  hermes: ["mcp", "resolve"],
  openclaw: ["mcp", "rules", "resolve"],
  antigravity: ["mcp", "cli", "hooks", "commands", "rules", "sync", "scribe", "resolve"],
  mcp: ["mcp", "resolve"],
  "claude-ai": ["mcp", "resolve"]
};

// packages/plugin-core/src/host.ts
import os2 from "node:os";
import path2 from "node:path";
var BaseHost = class {
  constructor(kind, home) {
    this.kind = kind;
    this.home = home;
  }
  kind;
  home;
  homeDir() {
    return this.home;
  }
  plansDir() {
    return path2.join(this.home, "plans");
  }
};
var ClaudeCodeHost = class extends BaseHost {
  constructor() {
    super("claude-code", path2.join(os2.homedir(), ".claude"));
  }
};
var CursorHost = class extends BaseHost {
  constructor() {
    super("cursor", path2.join(os2.homedir(), ".config", "memlin"));
  }
};
var CodexHost = class extends BaseHost {
  constructor() {
    super("codex", path2.join(os2.homedir(), ".config", "memlin"));
  }
};
var WindsurfHost = class extends BaseHost {
  constructor() {
    super("windsurf", path2.join(os2.homedir(), ".config", "memlin"));
  }
};
var AntigravityHost = class extends BaseHost {
  constructor() {
    super("antigravity", path2.join(os2.homedir(), ".config", "memlin"));
  }
};
var HOSTS = {
  "claude-code": () => new ClaudeCodeHost(),
  cursor: () => new CursorHost(),
  codex: () => new CodexHost(),
  windsurf: () => new WindsurfHost(),
  antigravity: () => new AntigravityHost()
};
function resolveHost() {
  const envHost = process.env.MEMLIN_HOST ?? (process.env.CURSOR_AGENT ? "cursor" : "claude-code");
  const make = HOSTS[envHost];
  return (make ?? HOSTS["claude-code"])();
}

// packages/plugin-core/src/memlin-api-client.ts
var DEFAULT_API_URL = "https://memlin.ai/api/v1";
function agentDevice() {
  return process.env.MEMLIN_AGENT_DEVICE || os3.hostname() || "unknown";
}
function agentVersion() {
  return process.env.MEMLIN_AGENT_VERSION || "0.1.0";
}
function agentCapabilities() {
  return AGENT_EXPECTED_CAPABILITIES[resolveHost().kind] ?? ["api", "resolve"];
}
var MemlinApiClient = class {
  constructor(cfg) {
    this.cfg = cfg;
  }
  cfg;
  // ---------- low-level ----------
  async authHeaders(includeAccount = true) {
    const token = await this.cfg.getAccessToken();
    const h = {
      Authorization: `Bearer ${token}`,
      [AGENT_KIND_HEADER]: resolveHost().kind,
      [AGENT_DEVICE_HEADER]: agentDevice(),
      [AGENT_VERSION_HEADER]: agentVersion(),
      [AGENT_CAPABILITIES_HEADER]: agentCapabilities().join(",")
    };
    if (includeAccount && this.cfg.accountId) {
      h["Memlin-Account-Id"] = this.cfg.accountId;
    }
    return h;
  }
  async request(method, pathAndQuery, body, opts = {}) {
    const url = `${this.cfg.baseUrl.replace(/\/+$/, "")}${pathAndQuery}`;
    const baseHeaders = await this.authHeaders(opts.includeAccount ?? true);
    if (opts.accountId) {
      baseHeaders["Memlin-Account-Id"] = opts.accountId;
    }
    const headers = {
      ...baseHeaders,
      Accept: "application/json"
    };
    if (body !== void 0) headers["Content-Type"] = "application/json";
    const res = await fetch(url, {
      method,
      headers,
      ...body !== void 0 ? { body: JSON.stringify(body) } : {}
    });
    const text = await res.text();
    let parsed = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
      }
    }
    if (!res.ok) {
      const errMsg = parsed?.error ?? text ?? `HTTP ${res.status}`;
      throw new Error(`${method} ${pathAndQuery} \u2192 ${res.status}: ${errMsg}`);
    }
    return parsed;
  }
  // ---------- endpoints ----------
  /** GET /me — identity + account list. No account header sent (this is the discovery call). */
  async me() {
    return this.request("GET", "/me", void 0, { includeAccount: false });
  }
  /**
   * POST /roles/assign — set a member's functional roles (backend, sre,
   * ...). Defaults to the caller; pass user_id to assign another member
   * (owner/admin only). Replaces the member's set wholesale.
   */
  async assignRoles(input, opts = {}) {
    return this.request("POST", "/roles/assign", input, {
      accountId: opts.accountId
    });
  }
  /**
   * POST /roles/tag — tag a document into one or more role packs. The
   * resolver boosts the document for members holding a matching role.
   * Replaces the document's role tags wholesale.
   */
  async tagDocumentRoles(input, opts = {}) {
    return this.request("POST", "/roles/tag", input, {
      accountId: opts.accountId
    });
  }
  /**
   * POST /documents/pin — force-include ("pin") a document, or unpin it.
   * A pinned doc is fetched out-of-band by the resolver on every resolve in
   * scope (no similarity threshold) and reserved budget off the top — a
   * standing directive, not a similarity hit. Owner/admin-only server-side.
   */
  async setDocumentPinned(input, opts = {}) {
    return this.request("POST", "/documents/pin", input, {
      accountId: opts.accountId
    });
  }
  /** GET /decisions/enforce — pull the guardrail rules currently
   *  in effect for the caller's account (and optionally a project).
   *  Returns kind='decision' docs whose `metadata.enforce` is set —
   *  the PreToolUse handler in plugin-core's pre-tool-use-handler
   *  module is the primary caller. */
  async listEnforceDecisions(opts = {}) {
    const qs = new URLSearchParams();
    if (opts.project_id !== void 0) {
      qs.set("project_id", opts.project_id === null ? "null" : opts.project_id);
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return this.request("GET", `/decisions/enforce${suffix}`);
  }
  /** POST /usage/event — write a usage_events row from the client.
   *  Server-side enforces an allowlist of event_types (today:
   *  tool.guardrail, action.invoke, resolve.outcome, edit.activity) and
   *  re-derives account_id and user_id from the auth context so callers
   *  can't forge rows for other workspaces. `opts.accountId` routes the
   *  write to a non-default account (multi-account workspaces). */
  async writeUsageEvent(input, opts = {}) {
    return this.request("POST", "/usage/event", input, { accountId: opts.accountId });
  }
  /** GET /documents — list, filtered. */
  async listDocuments(opts = {}) {
    const qs = new URLSearchParams();
    if (opts.kinds) for (const k of opts.kinds) qs.append("kind", k);
    if (opts.scopes) for (const s of opts.scopes) qs.append("scope", s);
    if (opts.statuses) for (const s of opts.statuses) qs.append("status", s);
    if (opts.project_id !== void 0) {
      qs.set("project_id", opts.project_id === null ? "null" : opts.project_id);
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const res = await this.request("GET", `/documents${suffix}`);
    return res.documents.map((d) => {
      const { status, ...rest } = d;
      return status == null ? rest : { ...rest, status };
    });
  }
  /** POST /documents — create or update a document. */
  async writeDocument(input) {
    return this.request("POST", "/documents", input);
  }
  /** GET /documents/{id}/versions — history. */
  async listVersions(documentId) {
    const res = await this.request(
      "GET",
      `/documents/${encodeURIComponent(documentId)}/versions`
    );
    return res.versions;
  }
  /** POST /documents/{id}/revert — non-destructive revert to an older version. */
  async revertDocument(documentId, targetVersionId, commitMessage) {
    const res = await this.request(
      "POST",
      `/documents/${encodeURIComponent(documentId)}/revert`,
      {
        target_version_id: targetVersionId,
        ...commitMessage ? { commit_message: commitMessage } : {}
      }
    );
    return res.new_version_id;
  }
  /** GET /inbox — pending scribe proposals (newest first), plus recently
   *  auto-activated correction rules (so the user can see what stuck + undo).
   *  Pass `opts.accountId` to read a different account's inbox than the pinned
   *  one (e.g. `memlin status` showing the resolver-effective account). */
  async listInbox(opts = {}) {
    return this.request("GET", "/inbox", void 0, { accountId: opts.accountId });
  }
  /** GET /insights — pending derived insights, including auto-memory proposals. */
  async listInsights(params = {}, opts = {}) {
    const search = new URLSearchParams();
    if (params.kind) search.set("kind", params.kind);
    if (params.status) search.set("status", params.status);
    if (params.limit) search.set("limit", String(params.limit));
    const qs = search.toString();
    return this.request(
      "GET",
      `/insights${qs ? `?${qs}` : ""}`,
      void 0,
      { accountId: opts.accountId }
    );
  }
  async resolveInsight(insightId, action) {
    return this.request("POST", `/insights/${encodeURIComponent(insightId)}/resolve`, { action });
  }
  /** POST /inbox/{id} — accept or reject a proposal. */
  async resolveProposal(proposalId, action) {
    return this.request("POST", `/inbox/${encodeURIComponent(proposalId)}`, {
      action
    });
  }
  async listHandoffs(opts = {}) {
    const qs = new URLSearchParams();
    if (opts.project_id) qs.set("project_id", opts.project_id);
    if (opts.target_agent_kind) qs.set("target_agent_kind", opts.target_agent_kind);
    if (opts.status) qs.set("status", opts.status);
    if (opts.limit) qs.set("limit", String(opts.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return this.request("GET", `/handoffs${suffix}`);
  }
  async updateHandoff(handoffId, action) {
    return this.request("PATCH", `/handoffs/${encodeURIComponent(handoffId)}`, {
      action
    });
  }
  async createHandoff(input) {
    return this.request("POST", "/handoffs", input);
  }
  /** POST /documents/search — semantic + text. */
  async search(query, opts = {}) {
    const res = await this.request("POST", "/documents/search", {
      query,
      ...opts
    });
    return res.hits;
  }
  /** GET /documents?q=... — fuzzy title/path lookup. Used by `memlin revert`. */
  async findDocumentsByName(needle, limit = 10) {
    const qs = new URLSearchParams({ q: needle, limit: String(limit) });
    const res = await this.request("GET", `/documents?${qs.toString()}`);
    return res.documents;
  }
  /**
   * POST /resolve — the marquee context-assembly endpoint.
   *
   * `cwd` and `git_remote` let the server infer the caller's active component
   * (when the project has any defined) and apply a soft +0.15 boost to
   * docs tagged to that component. Both are optional; omitting them yields
   * the same project-wide ranking we used pre-component-awareness.
   */
  async resolve(args, opts = {}) {
    return this.request("POST", "/resolve", args, {
      accountId: opts.accountId
    });
  }
  /**
   * GET /account — name/tier/kind for the current account.
   *
   * Pass `opts.accountId` to target an account other than the pinned one.
   * `memlin status` uses this to show the resolver-effective account in a
   * multi-account workspace, so the returned `id` and `name` always describe
   * the same account (no global-default/pinned-name mismatch).
   */
  async getAccount(opts = {}) {
    return this.request("GET", "/account", void 0, { accountId: opts.accountId });
  }
  /**
   * POST /projects/resolve — server-side project resolution.
   *
   * Returns `account_id` when a project matches in any account the user
   * has access to (via the JWT's memlin_account_ids claim) — not just the
   * one pinned in config. Callers use the returned account_id to retarget
   * the actual resolve / write call to the right backend.
   */
  async resolveProject(input) {
    return this.request("POST", "/projects/resolve", input);
  }
  /**
   * POST /deploy-guard — acquire or release the per-project deploy lease.
   *
   * The PreToolUse deploy hook calls `acquire` before a deploy command runs;
   * the PostToolUse hook calls `release` after. `acquired: false` means another
   * session already holds an active lease (the hook then warns or blocks).
   * project_id is passed explicitly — the hook resolves it from cwd first.
   */
  async deployGuard(input, opts = {}) {
    return this.request("POST", "/deploy-guard", input, { accountId: opts.accountId });
  }
  /** GET /audit/<id>/replay — reconstruct a past resolve's exact bundle. */
  async replayAudit(auditId) {
    return this.request("GET", `/audit/${auditId}/replay`);
  }
  /** GET /audit/<id>/explain — per-item decomposition of a past resolve's
   *  ranking arithmetic (similarity, kind weight, component boost, rerank,
   *  decay) plus human-readable reasons. The "homework, shown" companion
   *  to /replay. */
  async explainAudit(auditId) {
    return this.request("GET", `/audit/${auditId}/explain`);
  }
  /** GET /actions — list approved actions in the workspace. Same shape
   *  the memlin_actions_list MCP tool returns. */
  async listActions(opts = {}) {
    const q = [];
    if (opts.filter) q.push(`filter=${encodeURIComponent(opts.filter)}`);
    if (opts.limit !== void 0) q.push(`limit=${opts.limit}`);
    const qs = q.length > 0 ? `?${q.join("&")}` : "";
    const { actions } = await this.request("GET", `/actions${qs}`);
    return actions;
  }
  /** POST /actions/<id>/execute — invoke a callable action by id with
   *  validated input. Returns the result + audit_id. */
  async executeAction(actionId, input) {
    return this.request("POST", `/actions/${actionId}/execute`, { input });
  }
  /** POST /prompt-ci — run Prompt CI regression tests for a skill. */
  async runPromptCi(skillId, content) {
    return this.request("POST", "/prompt-ci", { skill_id: skillId, content });
  }
  /**
   * POST /memory/propose — extract memory candidates from a recent agent
   * turn and queue them for user accept/dismiss. Fire-and-forget from the
   * Stop hook's perspective; the server runs a cheap Haiku extraction and
   * silently no-ops if it finds nothing worth remembering.
   */
  async proposeMemory(input, opts = {}) {
    return this.request("POST", "/memory/propose", input, { accountId: opts.accountId });
  }
  /**
   * POST /scribe/diff — Phase 2 auto-capture from a single git commit.
   *
   * Called by the PostToolUse hook after the agent runs `git commit`.
   * The server reads the commit message + diff, asks Haiku to extract
   * any decision/memory/skill baked into the change, and persists
   * results as documents with metadata.status='proposed'. They appear
   * in the user's inbox until accepted.
   */
  async scribeDiff(input, opts = {}) {
    return this.request("POST", "/scribe/diff", input, { accountId: opts.accountId });
  }
  /**
   * POST /scribe/session — Phase 1 auto-capture from a Claude Code
   * session transcript. Server slices the transcript (tail-biased
   * when too large), runs Haiku extraction, persists proposals.
   *
   * Triggered manually by /memlin-scribe today; an auto-triggered
   * variant on Stop with a 15-min debounce is a fast follow-up.
   */
  async scribeSession(input, opts = {}) {
    return this.request("POST", "/scribe/session", input, { accountId: opts.accountId });
  }
  /**
   * POST /plans — upload a Claude Code plan as a first-class plan document.
   *
   * Server resolves project from cwd/git_remote (when not pinned), writes
   * the document via writeDocument (auto-embedding), and inserts a
   * companion plans row with status='drafted'. Returns the document_id
   * + version metadata for downstream URL construction.
   */
  async pushPlan(input) {
    return this.request("POST", "/plans", input);
  }
  /**
   * GET /plans — list plans for the account, optionally filtered by
   * `updated_after` (epoch ms) for cheap delta polling. Used by the
   * UserPromptSubmit + SessionStart hooks to keep ~/.claude/plans/ in
   * sync with the server.
   */
  async listPlans(opts = {}) {
    const qs = new URLSearchParams();
    if (opts.status) qs.set("status", opts.status);
    if (opts.project_id !== void 0) {
      qs.set("project_id", opts.project_id === null ? "null" : opts.project_id);
    }
    if (opts.updated_after) qs.set("updated_after", opts.updated_after);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const res = await this.request(
      "GET",
      `/plans${suffix}`
    );
    return res.plans;
  }
  /** GET /plans/<id> — full plan detail (status + body + bundle ref). */
  async getPlan(id) {
    return this.request("GET", `/plans/${encodeURIComponent(id)}`);
  }
  /**
   * PATCH /plans/<id> — replace the plan's body (creates a new
   * document_version, auto-embeds). Used by the PostToolUse hook to push
   * Claude Code edits back up to Memlin.
   */
  async updatePlan(id, input) {
    return this.request("PATCH", `/plans/${encodeURIComponent(id)}`, input);
  }
  /**
   * POST /projects — create a project in the caller's current account.
   * Used by `memlin init` to register a Claude Code workspace.
   */
  async createProject(input, opts = {}) {
    return this.request("POST", "/projects", input, { accountId: opts.accountId });
  }
  /**
   * POST /ask — natural-language Q&A over the team's workspace memory.
   * Server resolves a bundle, sends it to Claude, returns answer +
   * citations + audit_id. Used by `memlin ask` CLI and the web /ask
   * panel.
   */
  async ask(input, opts = {}) {
    return this.request("POST", "/ask", input, { accountId: opts.accountId });
  }
  /** GET /projects — list every project in the current account. */
  async listProjects(opts = {}) {
    const res = await this.request("GET", "/projects", void 0, { accountId: opts.accountId });
    return res.projects;
  }
};
function resolveApiUrl() {
  return process.env.MEMLIN_API_URL?.trim() || DEFAULT_API_URL;
}

// packages/plugin-core/src/resolver-skill.ts
var RESOLVER_SKILL_MD = `---
name: Memlin
description: Memlin auto-resolves project context (skills, memory, approved goals, schemas) into your prompt before you process it. This skill tells you how to *use* that context, and when to fall back to invoking memlin_resolve_task manually.
---

# Memlin Resolver

The Memlin plugin's UserPromptSubmit hook auto-injects a \`<memlin-resolved-context>\`
block into every non-trivial user prompt \u2014 *before* you see the prompt. The
block contains the same scope-correct, citation-bearing bundle that
\`memlin_resolve_task\` would return: top skills, memory, approved goals,
schemas, kind-weighted and threshold-filtered to ~4k tokens.

## How to use the pre-resolved bundle

1. **Read it as authoritative project context.** It's already scope-filtered
   (project + workspace, RLS-enforced server-side) \u2014 you don't need to ask the
   user for access.
2. **Apply the primary skill's framework** first. Use supporting skills for
   complementary perspectives. **Treat memory facts as project ground truth**
   (more authoritative than your training data when they conflict). **Honor
   goals as constraints.** **Validate against any schemas.**
3. **Cite your sources.** When stating a fact or following a constraint from
   the bundle, mention the source path + version. Example: "Per
   \`goals/auth-required.md\` v1, every new endpoint requires authn."
4. **Don't re-invoke \`memlin_resolve_task\`** for the current user message \u2014
   the bundle is already in your context. Re-invoking just wastes a tool call.

## When to invoke memlin_search or memlin_read_memory yourself

The auto-resolve covers the task at hand. Use the MCP tools directly when you
need to *explore* beyond the resolved bundle:

- The user asks "what does Memlin know about X?" where X is broader than the
  current task \u2192 \`memlin_search\` with X as the query.
- You need ALL of something (e.g. "list all approved goals in this project")
  \u2192 \`memlin_read_memory\` with the appropriate filter.
- You want to read the full body of a doc the bundle only cited a snippet of
  \u2192 \`memlin_get_document\` with the doc id.

## Empty bundle

If the resolved-context block is missing or empty, it means either (a) the
user's prompt was trivial enough that the hook skipped it, or (b) nothing in
the workspace cleared the per-kind similarity threshold for this task.
Proceed with your general expertise and note that you didn't find specialized
context for this task.
`;

// packages/plugin-core/src/plugin-install.ts
import { promises as fs2 } from "node:fs";
import { existsSync } from "node:fs";
import path3 from "node:path";
import os4 from "node:os";
var MEMLIN_PLUGIN_KEY = "memlin@memlin-ai";
var MEMLIN_MARKETPLACE_KEY = "memlin-ai";
var MEMLIN_MARKETPLACE_SOURCE = {
  source: "github",
  repo: "memlin-ai/memlin-claude-plugin"
};
function defaultUserSettingsPaths() {
  const claudeDir = path3.join(os4.homedir(), ".claude");
  return { claudeDir, settingsFile: path3.join(claudeDir, "settings.json") };
}
async function ensureUserScopePluginEnabled(paths) {
  const p = paths ?? defaultUserSettingsPaths();
  try {
    await fs2.mkdir(p.claudeDir, { recursive: true });
    let current = {};
    if (existsSync(p.settingsFile)) {
      const raw = await fs2.readFile(p.settingsFile, "utf8");
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") current = parsed;
      } catch (err) {
        return {
          status: "failed",
          settingsFile: p.settingsFile,
          detail: `existing settings.json isn't valid JSON: ${err instanceof Error ? err.message : String(err)}`
        };
      }
    }
    const alreadyEnabled = current.enabledPlugins?.[MEMLIN_PLUGIN_KEY] === true;
    const marketplaceKnown = !!current.extraKnownMarketplaces?.[MEMLIN_MARKETPLACE_KEY];
    if (alreadyEnabled && marketplaceKnown) {
      return {
        status: "already-enabled",
        settingsFile: p.settingsFile,
        detail: "plugin already enabled at user scope"
      };
    }
    const next = {
      ...current,
      enabledPlugins: {
        ...current.enabledPlugins ?? {},
        [MEMLIN_PLUGIN_KEY]: true
      }
    };
    let touchedMarketplace = false;
    if (!marketplaceKnown) {
      next.extraKnownMarketplaces = {
        ...current.extraKnownMarketplaces ?? {},
        [MEMLIN_MARKETPLACE_KEY]: { source: { ...MEMLIN_MARKETPLACE_SOURCE } }
      };
      touchedMarketplace = true;
    }
    await fs2.writeFile(p.settingsFile, JSON.stringify(next, null, 2) + "\n", "utf8");
    return {
      status: touchedMarketplace ? "enabled-with-marketplace" : "enabled",
      settingsFile: p.settingsFile,
      detail: touchedMarketplace ? "enabled plugin + registered Memlin marketplace" : "enabled plugin (marketplace already registered)"
    };
  } catch (err) {
    return {
      status: "failed",
      settingsFile: p.settingsFile,
      detail: err instanceof Error ? err.message : String(err)
    };
  }
}

// packages/plugin-core/src/cli/login.ts
var CONFIG_DIR = path4.join(os5.homedir(), ".config", "memlin");
var CONFIG_FILE = path4.join(CONFIG_DIR, "config.json");
var RESOLVER_SKILL_DIR = path4.join(os5.homedir(), ".claude", "skills", "memlin");
var RESOLVER_SKILL_FILE = path4.join(RESOLVER_SKILL_DIR, "SKILL.md");
async function installResolverSkill() {
  try {
    try {
      const stat = await fs3.stat(RESOLVER_SKILL_FILE);
      if (stat.size > 0) {
        return { status: "kept", path: RESOLVER_SKILL_FILE };
      }
    } catch {
    }
    await fs3.mkdir(RESOLVER_SKILL_DIR, { recursive: true });
    await fs3.writeFile(RESOLVER_SKILL_FILE, RESOLVER_SKILL_MD, "utf8");
    return { status: "installed", path: RESOLVER_SKILL_FILE };
  } catch (e) {
    return {
      status: "failed",
      path: RESOLVER_SKILL_FILE,
      error: e instanceof Error ? e.message : String(e)
    };
  }
}
function parseLoginArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--account" || a === "-a") {
      const v = argv[++i];
      if (!v) return { error: "--account requires a value" };
      out.requestedAccount = v;
    } else if (a === "--help" || a === "-h") {
      return { error: "help" };
    } else if (a?.startsWith("--")) {
      return { error: `unknown flag: ${a}` };
    }
  }
  return out;
}
function pickAccount(accounts, needle) {
  const exact = accounts.find((a) => a.id === needle);
  if (exact) return exact;
  const lower = needle.toLowerCase();
  const matches = accounts.filter((a) => a.name.toLowerCase().includes(lower));
  if (matches.length === 1) return matches[0];
  return null;
}
async function main() {
  const parsed = parseLoginArgs(process.argv.slice(2));
  if ("error" in parsed) {
    if (parsed.error === "help") {
      console.log("memlin login [--account <uuid-or-name>]");
      console.log("");
      console.log("Authenticate to Memlin and pin the active account.");
      console.log("  --account <v>   Override server-side default_account_id with this account");
      console.log("                  (must be one you're a member of)");
      process.exit(0);
    }
    console.error(`memlin login: ${parsed.error}`);
    process.exit(2);
  }
  const { requestedAccount } = parsed;
  console.log("memlin login");
  console.log("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
  const device = await startDeviceFlow();
  console.log("");
  console.log("  Open this URL in your browser to sign in:");
  console.log("");
  console.log(`    \x1B[1m${device.verification_uri_complete}\x1B[0m`);
  console.log("");
  console.log(`  Verification code: \x1B[1m${device.user_code}\x1B[0m`);
  console.log(`  Expires in ${Math.floor(device.expires_in / 60)} min.`);
  console.log("");
  process.stdout.write("  waiting for approval");
  const token = await pollForToken(device.device_code, device.interval, (elapsed) => {
    process.stdout.write(elapsed % 5 === 0 ? "." : "");
  });
  process.stdout.write("\n\n");
  await writePersistedToken(token);
  const apiUrl = resolveApiUrl();
  const probe = new MemlinApiClient({
    baseUrl: apiUrl,
    getAccessToken: async () => token.access_token,
    accountId: "00000000-0000-0000-0000-000000000000"
  });
  let me;
  try {
    me = await probe.me();
  } catch (err) {
    console.error(
      "memlin login: signed in to Auth0, but the Memlin API rejected the token.\n  Endpoint: " + apiUrl + "\n  Error: " + (err instanceof Error ? err.message : String(err))
    );
    process.exit(1);
  }
  if (me.accounts.length === 0) {
    console.error(
      "No Memlin workspaces on this user. Open https://memlin.ai once to bootstrap a personal workspace, then re-run `memlin login`."
    );
    process.exit(1);
  }
  let accountId;
  let accountName;
  if (requestedAccount) {
    const picked = pickAccount(
      me.accounts.map((a) => ({ id: a.id, name: a.name })),
      requestedAccount
    );
    if (!picked) {
      console.error(
        `memlin login: --account "${requestedAccount}" doesn't match any account you're a member of.`
      );
      console.error("Your accounts:");
      for (const a of me.accounts) {
        console.error(`  ${a.id}  ${a.name}`);
      }
      process.exit(1);
    }
    accountId = picked.id;
    accountName = picked.name;
  } else {
    accountId = me.default_account_id ?? me.accounts[0].id;
    accountName = me.accounts.find((a) => a.id === accountId)?.name ?? "(unknown)";
  }
  const config = {
    api_url: apiUrl,
    account_id: accountId,
    user_id: me.user_id,
    project_id: null
  };
  await fs3.mkdir(CONFIG_DIR, { recursive: true });
  await fs3.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
  const displayName = me.display_name ?? me.email ?? me.user_id.slice(0, 8) + "\u2026";
  console.log(`  \u2713 signed in as ${displayName}`);
  console.log(`  \u2713 workspace "${accountName}"`);
  const installed = await installResolverSkill();
  if (installed.status === "installed") {
    console.log(`  \u2713 installed Memlin resolver skill (${installed.path})`);
  } else if (installed.status === "kept") {
    console.log(`  \u2713 Memlin resolver skill already present (${installed.path})`);
  } else {
    console.log(
      `  ! couldn't install Memlin resolver skill at ${installed.path}: ${installed.error ?? "unknown error"}`
    );
  }
  const pluginInstall = await ensureUserScopePluginEnabled();
  if (pluginInstall.status === "enabled") {
    console.log(`  \u2713 enabled Memlin plugin user-wide (${pluginInstall.settingsFile})`);
    console.log(`    every Claude Code workspace now loads Memlin hooks + slash commands.`);
  } else if (pluginInstall.status === "enabled-with-marketplace") {
    console.log(`  \u2713 enabled Memlin plugin + registered marketplace (${pluginInstall.settingsFile})`);
    console.log(`    every Claude Code workspace now loads Memlin hooks + slash commands.`);
  } else if (pluginInstall.status === "already-enabled") {
    console.log(`  \u2713 Memlin plugin already enabled user-wide (${pluginInstall.settingsFile})`);
  } else {
    console.log(`  ! couldn't enable Memlin plugin user-wide: ${pluginInstall.detail}`);
    console.log(`    Run \`/plugin install memlin@memlin-ai\` in any workspace to enable manually.`);
  }
  console.log("");
  console.log("  Run `memlin pull` to fetch your memory, skills, and goals.");
}
main().catch((err) => {
  console.error("memlin login failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
