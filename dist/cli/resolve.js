#!/usr/bin/env node
import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);

// packages/plugin-core/src/cli/resolve.ts
import { execSync as execSync2 } from "node:child_process";

// packages/plugin-core/src/client.ts
import { promises as fs3 } from "node:fs";
import path4 from "node:path";
import os4 from "node:os";

// packages/plugin-core/src/auth.ts
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
var MEMLIN_PROD_AUTH0_DOMAIN = "memlin.us.auth0.com";
var MEMLIN_PROD_AUTH0_CLIENT_ID = "fyYMQ4Cxc6Nu5juVwL8Ihqq4fgAFecG9";
var AUTH0_DOMAIN = process.env.MEMLIN_AUTH0_DOMAIN || MEMLIN_PROD_AUTH0_DOMAIN;
var AUTH0_CLIENT_ID = process.env.MEMLIN_AUTH0_CLIENT_ID || MEMLIN_PROD_AUTH0_CLIENT_ID;
var AUTH0_AUDIENCE = process.env.MEMLIN_AUTH0_AUDIENCE ?? "https://api.memlin.ai";
function tokenFilePath() {
  return process.env.MEMLIN_TOKEN_FILE || path.join(os.homedir(), ".config", "memlin", "token.json");
}
async function readPersistedToken() {
  try {
    const raw = await fs.readFile(tokenFilePath(), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
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
async function refreshAccessToken(refreshToken) {
  requireClientId();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: AUTH0_CLIENT_ID
  });
  const res = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  if (!res.ok) {
    throw new Error(`refresh: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return toPersisted(json, refreshToken);
}
var refreshInFlight = null;
async function getValidAccessToken() {
  const persisted = await readPersistedToken();
  if (!persisted) throw new Error("not signed in \u2014 run `memlin login`");
  if (Date.now() < persisted.expires_at - 6e4) return persisted.access_token;
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = doRefresh(persisted).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}
async function doRefresh(stale) {
  const latest = await readPersistedToken();
  if (latest && Date.now() < latest.expires_at - 6e4) return latest.access_token;
  const refreshToken = latest?.refresh_token ?? stale.refresh_token;
  if (!refreshToken) {
    throw new Error("access token expired and no refresh token saved \u2014 run `memlin login`");
  }
  try {
    const fresh = await refreshAccessToken(refreshToken);
    await writePersistedToken(fresh);
    return fresh.access_token;
  } catch (err) {
    const after = await readPersistedToken();
    if (after && after.access_token !== stale.access_token && Date.now() < after.expires_at - 6e4) {
      return after.access_token;
    }
    throw new Error(
      `access token refresh failed (${err instanceof Error ? err.message : String(err)}) \u2014 run \`memlin login\``
    );
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
var PROVIDER_HOSTS = [
  "github.com",
  "gitlab.com",
  "bitbucket.org",
  "dev.azure.com",
  "ssh.dev.azure.com",
  "codeberg.org",
  "sr.ht",
  "git.sr.ht"
];
function normalizeGitRemote(raw) {
  if (!raw) return null;
  let s = raw.trim();
  if (!s) return null;
  s = s.replace(/^git@([^:]+):/, "https://$1/");
  s = s.replace(/^ssh:\/\//, "");
  s = s.replace(/^https?:\/\//, "");
  s = s.replace(/^git@/, "");
  s = s.replace(/\.git$/, "");
  s = s.replace(/\/$/, "");
  const slash = s.indexOf("/");
  if (slash > 0) {
    const host = s.slice(0, slash);
    const rest = s.slice(slash);
    for (const provider of PROVIDER_HOSTS) {
      if (host === provider) break;
      if (host.startsWith(provider + "-")) {
        s = provider + rest;
        break;
      }
    }
  }
  return s || null;
}

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
   * PATCH /projects/{id} — attach/detach local paths, set/clear the git
   * remote, or rename. Owner/admin only; 409 when a path or remote is
   * already attached to another project in the account. Backs
   * `memlin attach-path` and add-project's attach-instead-of-fork offer.
   */
  async patchProject(projectId, input, opts = {}) {
    return this.request("PATCH", `/projects/${encodeURIComponent(projectId)}`, input, {
      accountId: opts.accountId
    });
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

// packages/plugin-core/src/workspace-binding.ts
import { promises as fs2 } from "node:fs";
import path3 from "node:path";
var WORKSPACE_DIR_NAME = ".memlin";
var WORKSPACE_BINDING_FILE = "config.json";
async function findWorkspaceBinding(startDir) {
  let dir = path3.resolve(startDir);
  for (let i = 0; i < 64; i++) {
    const candidate = path3.join(dir, WORKSPACE_DIR_NAME, WORKSPACE_BINDING_FILE);
    try {
      const raw = await fs2.readFile(candidate, "utf8");
      const parsed = JSON.parse(raw);
      if (typeof parsed.account_id === "string" && parsed.account_id) {
        return {
          binding: {
            account_id: parsed.account_id,
            project_id: parsed.project_id ?? null,
            account_name: parsed.account_name
          },
          workspaceRoot: dir
        };
      }
    } catch {
    }
    const parent = path3.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

// packages/plugin-core/src/client.ts
var CONFIG_DIR = path4.join(os4.homedir(), ".config", "memlin");
var CONFIG_FILE = path4.join(CONFIG_DIR, "config.json");
var TOKEN_FILE = path4.join(CONFIG_DIR, "token.json");
async function readConfig() {
  try {
    const raw = await fs3.readFile(CONFIG_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed.account_id || !parsed.user_id) return null;
    return {
      api_url: parsed.api_url ?? DEFAULT_API_URL,
      account_id: parsed.account_id,
      user_id: parsed.user_id,
      project_id: parsed.project_id ?? null
    };
  } catch {
    return null;
  }
}
async function getApi(opts = {}) {
  const config = await readConfig();
  if (!config) return null;
  try {
    await getValidAccessToken();
  } catch {
    return null;
  }
  const cwd = opts.cwd ?? process.cwd();
  const overlay = await findWorkspaceBinding(cwd);
  const { workspaceBound, workspaceRoot } = applyWorkspaceOverlay(config, overlay);
  const apiUrl = process.env.MEMLIN_API_URL?.trim() || config.api_url || resolveApiUrl();
  const api = new MemlinApiClient({
    baseUrl: apiUrl,
    getAccessToken: getValidAccessToken,
    accountId: config.account_id
  });
  return { api, config, workspaceBound, workspaceRoot };
}
function applyWorkspaceOverlay(config, overlay) {
  if (!overlay) return { workspaceBound: false, workspaceRoot: null };
  config.account_id = overlay.binding.account_id;
  if (overlay.binding.project_id !== void 0) {
    config.project_id = overlay.binding.project_id;
  }
  return { workspaceBound: true, workspaceRoot: overlay.workspaceRoot };
}

// packages/plugin-core/src/project-resolver.ts
import { execSync } from "node:child_process";
import path5 from "node:path";
var WORKSPACE_ENV_VARS = [
  // Claude Code exposes the original project dir to hooks/plugin commands.
  "CLAUDE_PROJECT_DIR",
  // Cursor/plugin shims and local tests can set this explicitly.
  "CURSOR_WORKSPACE_ROOT",
  "CURSOR_PROJECT_ROOT",
  "MEMLIN_WORKSPACE_ROOT",
  // npm/pnpm set INIT_CWD to the directory where the user invoked a script.
  "INIT_CWD"
];
function runtimeCwd(fallback = process.cwd()) {
  for (const name of WORKSPACE_ENV_VARS) {
    const raw = process.env[name]?.trim();
    if (raw && path5.isAbsolute(raw)) return path5.resolve(raw);
  }
  return path5.resolve(fallback);
}
async function resolveProject(api, cwd, configProjectId) {
  const absCwd = path5.resolve(cwd);
  const remote = readGitRemote(cwd);
  try {
    const result = await api.resolveProject({
      git_remote: remote,
      cwd: absCwd
    });
    if (result.project_id) {
      return {
        project_id: result.project_id,
        project_name: result.name,
        account_id: result.account_id,
        reason: result.reason === "none" ? "config" : result.reason
      };
    }
  } catch {
  }
  if (configProjectId) {
    return {
      project_id: configProjectId,
      project_name: null,
      account_id: null,
      reason: "config"
    };
  }
  return { project_id: null, project_name: null, account_id: null, reason: "none" };
}
function readGitRemote(cwd) {
  try {
    const url = execSync("git remote get-url origin", {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8"
    }).trim();
    return normalizeGitRemote(url);
  } catch {
    return null;
  }
}
function isWorkspaceActive(input) {
  return Boolean(input.resolvedProjectId) || input.workspaceBound;
}

// packages/plugin-core/src/state.ts
import { promises as fs4 } from "node:fs";
import path6 from "node:path";
import os5 from "node:os";
import crypto from "node:crypto";
var STATE_FILE = path6.join(os5.homedir(), ".config", "memlin", "state.json");
var EMPTY = { documents: {} };
async function readState() {
  try {
    const raw = await fs4.readFile(STATE_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return { ...EMPTY };
  }
}
async function writeState(state) {
  await fs4.mkdir(path6.dirname(STATE_FILE), { recursive: true });
  const tmp = `${STATE_FILE}.${process.pid}.tmp`;
  await fs4.writeFile(tmp, JSON.stringify(state, null, 2), "utf8");
  await fs4.rename(tmp, STATE_FILE);
}
async function recordLastResolve(entry) {
  try {
    const state = await readState();
    state.last_resolve = entry;
    await writeState(state);
  } catch {
  }
}

// packages/plugin-core/src/cli/compile-bundle.ts
function formatCitation(c) {
  const parts = [];
  parts.push(c.citation.path ?? "(no path)");
  parts.push(`v${c.citation.version_number}`);
  parts.push(c.citation.updated_at);
  if (c.citation.author_id) parts.push(c.citation.author_id.slice(0, 8));
  return parts.join(" \xB7 ");
}
function renderBrandGuidelines(b) {
  const fm = b.frontmatter;
  const lines = [];
  const title = fm.name ?? "(unnamed brand guidelines)";
  if (b.mode === "pointer") {
    lines.push(
      `## BRAND GUIDELINES: ${title} (on file \u2014 not loaded for this task; mention brand/copy work to load them)`
    );
    lines.push("");
    return lines.join("\n");
  }
  lines.push(`## BRAND GUIDELINES: ${title} (${b.source})`);
  lines.push(`# source: brand-guidelines://${b.brand_guidelines_id} \xB7 ${b.updated_at}`);
  lines.push("");
  if (fm.tagline) lines.push(`Tagline: ${fm.tagline}`);
  if (fm.description) lines.push(`Description: ${fm.description}`);
  const colors = fm.colors ?? [];
  if (colors.length > 0) {
    lines.push("");
    lines.push("Colors:");
    for (const c of colors) {
      const head = `  - ${c.role}: ${c.name} ${c.hex}`;
      lines.push(c.usage ? `${head} \u2014 ${c.usage}` : head);
    }
  }
  const typo = fm.typography;
  if (typo) {
    lines.push("");
    lines.push("Typography:");
    if (typo.heading) lines.push(`  - heading: ${typo.heading.family}`);
    if (typo.body) lines.push(`  - body: ${typo.body.family}`);
    if (typo.mono) lines.push(`  - mono: ${typo.mono.family}`);
  }
  if (Object.keys(b.logo_urls).length > 0) {
    lines.push("");
    lines.push("Logos:");
    for (const [slot, url] of Object.entries(b.logo_urls)) {
      lines.push(`  - ${slot}: ${url}`);
    }
  }
  if (b.body.trim()) {
    lines.push("");
    lines.push(b.body.trim());
  }
  lines.push("");
  return lines.join("\n");
}
function renderArchitecture(a) {
  const lines = [];
  lines.push(`## ARCHITECTURE: ${a.component_name} \u2014 the component you're working in`);
  lines.push("# source: code graph (scanner-derived; no repo crawl needed)");
  lines.push("");
  if (a.depends_on.length > 0) {
    lines.push(
      "Depends on: " + a.depends_on.map((d) => `${d.component} (${d.edge_kinds.join("/") || "dependency"})`).join(", ")
    );
  }
  if (a.depended_on_by.length > 0) {
    lines.push("Depended on by: " + a.depended_on_by.map((d) => d.component).join(", "));
  }
  if (a.data.length > 0) {
    lines.push(
      "Database: " + a.data.map((d) => {
        const acc = d.access.join("+") || "accesses";
        return d.schema?.path ? `${d.table} (${acc}) \u2014 schema: ${d.schema.path}` : `${d.table} (${acc})`;
      }).join(", ")
    );
  }
  if ((a.api_calls?.length ?? 0) > 0) {
    lines.push("");
    lines.push("API calls (page \u2192 API \u2192 table):");
    for (const c of a.api_calls ?? []) {
      const m = c.method ? `${c.method} ` : "";
      if (c.served_by) {
        const t = c.served_by.tables.length > 0 ? ` \u2192 ${c.served_by.tables.join(", ")}` : "";
        const comp = c.served_by.component ? ` [${c.served_by.component}]` : "";
        lines.push(`  - ${m}${c.path} \u2192 ${c.served_by.route}${comp}${t}`);
      } else {
        lines.push(`  - ${m}${c.path} (no matching route found)`);
      }
    }
  }
  if (a.functions.length > 0) {
    lines.push("");
    lines.push(`Functions (${a.functions.length}${a.functions_truncated ? "+" : ""}):`);
    for (const f of a.functions) {
      lines.push(`  - ${f.name} [${f.kind}]${f.purpose ? ` \u2014 ${f.purpose}` : ""}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}
function renderItem(label, item, extra = []) {
  const lines = [];
  const metaParts = [`similarity ${item.similarity.toFixed(2)}`, ...extra];
  if (item.collapsed_duplicates && item.collapsed_duplicates > 0) {
    metaParts.push(`+${item.collapsed_duplicates} corroborating`);
  }
  if (item.verification) {
    const v = item.verification;
    metaParts.push(
      `verified: ${v.verdict} (${v.observed_at.slice(0, 10)}${v.count > 1 ? `, ${v.count} checks` : ""})`
    );
  }
  if (item.component_name) metaParts.push(`component: ${item.component_name}`);
  lines.push(`## ${label}: ${item.title} (${metaParts.join(", ")})`);
  lines.push(`# source: ${formatCitation(item)}`);
  lines.push("");
  lines.push(item.body.trimEnd());
  lines.push("");
  return lines.join("\n");
}
function renderPinned(items) {
  const lines = [];
  lines.push("## STANDING DIRECTIVES (pinned \u2014 always in context; obey these)");
  lines.push("# Force-included by an explicit pin, not by semantic match. Treat as");
  lines.push("# standing rules for this workspace. When a pinned directive conflicts");
  lines.push("# with similarity-matched memory below, the directive wins.");
  lines.push("");
  for (const item of items) {
    lines.push(`### [${item.kind.toUpperCase()}] ${item.title}`);
    lines.push(`# source: ${formatCitation(item)} \xB7 pinned`);
    lines.push("");
    lines.push(item.body.trimEnd());
    lines.push("");
  }
  return lines.join("\n");
}
function bundleSummary(r) {
  const b = r.bundle;
  const totalSkills = (b.primary_skill ? 1 : 0) + b.supporting_skills.length;
  const pieces = [];
  pieces.push(
    `${totalSkills} ${totalSkills === 1 ? "skill" : "skills"}` + (b.primary_skill ? ` (1 primary, ${b.supporting_skills.length} supporting)` : "")
  );
  pieces.push(`${b.memory.length} memory ${b.memory.length === 1 ? "fact" : "facts"}`);
  pieces.push(`${b.goals.length} ${b.goals.length === 1 ? "goal" : "goals"}`);
  pieces.push(`${b.schemas.length} ${b.schemas.length === 1 ? "schema" : "schemas"}`);
  const decisionCount = b.decisions?.length ?? 0;
  pieces.push(`${decisionCount} ${decisionCount === 1 ? "decision" : "decisions"}`);
  const pinnedCount = b.pinned?.length ?? 0;
  if (pinnedCount > 0) {
    pieces.push(`${pinnedCount} pinned`);
  }
  if (b.architecture) {
    pieces.push(`architecture: ${b.architecture.component_name}`);
  }
  return pieces.join(", ");
}
function renderItemXml(tagName, item, attributes = {}) {
  const attrs = Object.entries(attributes).map(([k, v]) => ` ${k}="${v}"`).join("");
  const corroborating = item.collapsed_duplicates && item.collapsed_duplicates > 0 ? ` corroborating="${item.collapsed_duplicates}"` : "";
  const verified = item.verification ? ` verified="${item.verification.verdict}" verified_at="${item.verification.observed_at}"` : "";
  const lines = [];
  lines.push(
    `<${tagName}${attrs} title="${item.title}" similarity="${item.similarity.toFixed(2)}"${corroborating}${verified}>`
  );
  lines.push(
    `  <citation path="${item.citation.path ?? "(no path)"}" version="v${item.citation.version_number}" updated="${item.citation.updated_at}" />`
  );
  lines.push(
    item.body.trim().split("\n").map((l) => `  ${l}`).join("\n")
  );
  lines.push(`</${tagName}>`);
  return lines.join("\n");
}
var TASK_ECHO_MAX_CHARS = 80;
function truncateTask(task) {
  const oneLine = task.replace(/\s+/g, " ").trim();
  return oneLine.length <= TASK_ECHO_MAX_CHARS ? oneLine : `${oneLine.slice(0, TASK_ECHO_MAX_CHARS - 1)}\u2026`;
}
function xmlAttr(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}
function attribution(e) {
  if (e.same_user) return "your other session \xB7 ";
  const bits = [];
  if (e.session_short) bits.push(`agent ${e.session_short}`);
  if (e.agent_kind) bits.push(e.agent_kind);
  return bits.length > 0 ? `${bits.join(" \xB7 ")} \xB7 ` : "";
}
function compileBundle(result, parsedTask, agent) {
  const b = result.bundle;
  const out = [];
  if (agent === "claude-code") {
    out.push(`<memlin_context task="${xmlAttr(truncateTask(parsedTask))}">`);
    if (result.active_component) {
      out.push(`  <active_component name="${result.active_component.name}" boost="0.15" />`);
    }
    if (b.pinned && b.pinned.length > 0) {
      out.push("  <standing_directives>");
      for (const item of b.pinned) {
        out.push(renderItemXml("directive", item, { kind: item.kind }));
      }
      out.push("  </standing_directives>");
    }
    if (b.architecture) {
      out.push("  <architecture>");
      out.push(`    <component name="${b.architecture.component_name}">`);
      if (b.architecture.depends_on.length > 0) {
        out.push(
          `      <depends_on>${b.architecture.depends_on.map((d) => d.component).join(", ")}</depends_on>`
        );
      }
      if (b.architecture.depended_on_by.length > 0) {
        out.push(
          `      <depended_on_by>${b.architecture.depended_on_by.map((d) => d.component).join(", ")}</depended_on_by>`
        );
      }
      if (b.architecture.data.length > 0) {
        out.push(`      <tables>${b.architecture.data.map((d) => d.table).join(", ")}</tables>`);
      }
      if (b.architecture.functions.length > 0) {
        out.push("      <functions>");
        for (const f of b.architecture.functions) {
          out.push(
            `        <function name="${f.name}" kind="${f.kind}" purpose="${f.purpose || ""}" />`
          );
        }
        out.push("      </functions>");
      }
      out.push("    </component>");
      out.push("  </architecture>");
    }
    if (b.brand_guidelines && b.brand_guidelines.mode === "pointer") {
      const name = b.brand_guidelines.frontmatter.name || "Brand Guidelines";
      out.push(
        `  <brand_guidelines name="${xmlAttr(name)}" mode="pointer" note="on file \u2014 not loaded for this task; mention brand/copy work to load them" />`
      );
    } else if (b.brand_guidelines) {
      out.push("  <brand_guidelines>");
      out.push(
        renderItemXml("guidelines", {
          id: b.brand_guidelines.brand_guidelines_id,
          kind: "memory",
          title: b.brand_guidelines.frontmatter.name || "Brand Guidelines",
          body: b.brand_guidelines.body,
          similarity: 1,
          citation: {
            path: "brand-guidelines",
            version_number: 1,
            updated_at: b.brand_guidelines.updated_at,
            author_id: null
          },
          component_id: null,
          component_name: null
        })
      );
      out.push("  </brand_guidelines>");
    }
    if (b.primary_skill) {
      out.push(renderItemXml("primary_skill", b.primary_skill));
    }
    if (b.supporting_skills.length > 0) {
      out.push("  <supporting_skills>");
      for (const s of b.supporting_skills) {
        out.push(renderItemXml("skill", s));
      }
      out.push("  </supporting_skills>");
    }
    if (b.goals.length > 0) {
      out.push("  <goals>");
      for (const g of b.goals) {
        out.push(renderItemXml("goal", g));
      }
      out.push("  </goals>");
    }
    if (b.decisions && b.decisions.length > 0) {
      out.push("  <decisions>");
      for (const d of b.decisions) {
        out.push(renderItemXml("decision", d));
      }
      out.push("  </decisions>");
    }
    if (b.schemas.length > 0) {
      out.push("  <schemas>");
      for (const s of b.schemas) {
        out.push(renderItemXml("schema", s));
      }
      out.push("  </schemas>");
    }
    if (b.memory.length > 0) {
      out.push("  <memory>");
      for (const m of b.memory) {
        out.push(renderItemXml("fact", m));
      }
      out.push("  </memory>");
    }
    out.push("</memlin_context>");
  } else {
    out.push(`# Memlin Resolved Context \u2014 task: ${truncateTask(parsedTask)}`);
    const componentNote = result.active_component ? `${result.active_component.name} (boosted by +0.15)` : "(none \u2014 project-wide search)";
    out.push(`# component: ${componentNote} \xB7 bundle: ${bundleSummary(result)}`);
    const tb = result.token_budget;
    const tokenLine = `# tokens: ${tb.used.toLocaleString()} / ${tb.limit.toLocaleString()}` + (tb.truncated ? " (truncated \u2014 lower-priority items dropped)" : "");
    out.push(tokenLine);
    out.push("");
    if (b.pinned && b.pinned.length > 0) {
      out.push(renderPinned(b.pinned));
    }
    const openThreads = b.open_threads ?? [];
    if (openThreads.length > 0) {
      out.push("## OPEN THREADS (entity-matched follow-ups \u2014 resolve or update these)");
      out.push("# Pulled by entity + status, not similarity: prior episodes that left an");
      out.push("# open prediction or promise touching this task. Close one by writing a");
      out.push("# new episodic memory whose custom.resolves points at it.");
      out.push("");
      for (const t of openThreads) {
        const meta = [];
        if (t.thread?.occurred_at) meta.push(t.thread.occurred_at.slice(0, 10));
        if (t.thread?.entities?.length) meta.push(t.thread.entities.join(", "));
        out.push(`### ${t.title}${meta.length ? ` (${meta.join(" \xB7 ")})` : ""}`);
        out.push(`# source: ${formatCitation(t)} \xB7 thread: open`);
        out.push("");
        out.push(t.body.trimEnd());
        out.push("");
      }
    }
    const deploys = b.deploy_in_progress ?? [];
    if (deploys.length > 0) {
      out.push("## DEPLOY IN PROGRESS");
      out.push("");
      out.push(
        `# ${deploys.length} other agent(s) appear to be mid-deploy on this project right now.`
      );
      out.push(
        "# Hold your own deploy until it clears, or coordinate \u2014 concurrent deploys can clobber each other."
      );
      for (const d of deploys) {
        const where = d.component ? `component "${d.component}"` : "project-wide";
        out.push(`  - agent ${d.session_short} \xB7 ${where} \xB7 ${d.minutes_ago}m ago \xB7 task: ${d.task}`);
      }
      out.push("");
    }
    const collisions = b.collision_warnings ?? [];
    if (collisions.length > 0) {
      out.push("## COLLISION WARNINGS");
      out.push("");
      for (const warning of collisions) {
        const where = warning.component ? `component "${warning.component}"` : "project-wide work";
        out.push(`# ${where}`);
        out.push(`# ${warning.guidance}`);
        for (const e of warning.entries) {
          out.push(`  - ${attribution(e)}${e.minutes_ago}m ago \xB7 task: ${e.task}`);
        }
        out.push("");
      }
    }
    const concurrent = b.concurrent_work ?? [];
    if (concurrent.length > 0) {
      out.push("## CONCURRENT WORK");
      out.push("");
      out.push(
        `# ${concurrent.length} other session(s) resolved on this project in the last 20 min \u2014`
      );
      out.push("# co-activity, not contention: check the task before assuming overlap.");
      for (const e of concurrent) {
        const where = e.component ? `component "${e.component}"` : "project-wide";
        out.push(`  - ${where} \xB7 ${attribution(e)}${e.minutes_ago}m ago \xB7 task: ${e.task}`);
      }
      out.push("");
    }
    const fileEdits = b.recent_file_edits ?? [];
    if (fileEdits.length > 0) {
      out.push("## RECENTLY EDITED BY OTHERS");
      out.push("");
      out.push(
        `# ${fileEdits.length} file(s) other sessions edited on this project in the last 15 min \u2014`
      );
      out.push("# the file-level heads-up. Re-read these before you edit them.");
      for (const f of fileEdits) {
        out.push(`  - ${f.path} \xB7 ${attribution(f)}${f.minutes_ago}m ago`);
      }
      out.push("");
    }
    if (b.brand_guidelines) {
      out.push(renderBrandGuidelines(b.brand_guidelines));
    }
    if (b.claim_guardrails) {
      out.push("## APPROVED CLAIMS / COMPETITIVE GUARDRAILS");
      out.push("");
      for (const item of b.claim_guardrails.approved) {
        out.push(renderItem("APPROVED CLAIM", item));
      }
      for (const item of b.claim_guardrails.blocked) {
        out.push(renderItem("BLOCKED CLAIM - DO NOT SAY", item));
      }
      for (const item of b.claim_guardrails.competitor_facts) {
        out.push(renderItem("COMPETITOR FACT", item));
      }
    }
    if (b.architecture) {
      out.push(renderArchitecture(b.architecture));
    }
    if (b.primary_skill) {
      out.push(renderItem("PRIMARY SKILL", b.primary_skill));
    } else {
      out.push("# (no skill above threshold \u2014 proceed with general expertise)");
      out.push("");
    }
    for (const s of b.supporting_skills) {
      out.push(renderItem("SUPPORTING SKILL", s));
    }
    for (const g of b.goals) {
      out.push(renderItem("GOAL", g, ["status: approved"]));
    }
    for (const d of b.decisions ?? []) {
      out.push(renderItem("DECISION", d));
    }
    for (const s of b.schemas) {
      out.push(renderItem("SCHEMA", s));
    }
    for (const m of b.memory) {
      out.push(renderItem("MEMORY", m));
    }
  }
  out.push(`# resolved_at: ${result.resolved_at}`);
  out.push(`# audit_id: ${result.audit_id || "(audit-log write failed \u2014 bundle is still valid)"}`);
  if (result.audit_id) {
    out.push(`# replay with: memlin audit replay ${result.audit_id}`);
    out.push(`# explain with: memlin audit explain ${result.audit_id}`);
  }
  return out.join("\n") + "\n";
}

// packages/plugin-core/src/cli/resolve.ts
function parseArgs(argv) {
  const positional = [];
  let project;
  let maxTokens;
  let hybrid;
  let agent;
  const kinds = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project" || a === "-p") {
      project = argv[++i];
      if (!project) return { error: "--project requires a value" };
    } else if (a === "--max-tokens") {
      const v = argv[++i];
      if (!v) return { error: "--max-tokens requires a value" };
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) return { error: `--max-tokens: bad number "${v}"` };
      maxTokens = Math.floor(n);
    } else if (a === "--kind" || a === "-k") {
      const v = argv[++i];
      if (!v) return { error: "--kind requires a value" };
      if (!["skill", "memory", "goal", "schema"].includes(v)) {
        return { error: `--kind: must be one of skill|memory|goal|schema (got "${v}")` };
      }
      kinds.push(v);
    } else if (a === "--agent" || a === "-a") {
      agent = argv[++i];
      if (!agent) return { error: "--agent requires a value" };
      if (!["claude-code", "cursor", "antigravity", "codex", "windsurf"].includes(agent)) {
        return {
          error: `--agent: must be one of claude-code|cursor|antigravity|codex|windsurf (got "${agent}")`
        };
      }
    } else if (a === "--hybrid") {
      hybrid = true;
    } else if (a === "--semantic") {
      hybrid = false;
    } else if (a === "--help" || a === "-h") {
      return { error: "help" };
    } else if (a?.startsWith("--")) {
      return { error: `unknown flag: ${a}` };
    } else if (a) {
      positional.push(a);
    }
  }
  const task = positional.join(" ").trim();
  if (!task) return { error: 'missing task. usage: memlin resolve "<task description>"' };
  return {
    task,
    ...project !== void 0 ? { project } : {},
    ...maxTokens !== void 0 ? { maxTokens } : {},
    ...kinds.length > 0 ? { kinds } : {},
    ...hybrid !== void 0 ? { hybrid } : {},
    ...agent !== void 0 ? { agent } : {}
  };
}
function printHelp() {
  console.log(
    [
      "memlin resolve \u2014 assemble specialized context for a task",
      "",
      "Usage:",
      '  memlin resolve "<task description>" [options]',
      "",
      "Options:",
      "  --project <id>      Override the auto-resolved project scope",
      "  --max-tokens <n>    Bundle token budget (default 4000)",
      "  --kind <k>          Restrict to a kind. Repeatable.",
      "                      One of: skill, memory, goal, schema",
      "  --agent <a_type>    Compile bundle for agent (claude-code|cursor|antigravity|codex|windsurf)",
      "  --hybrid            Use hybrid retrieval (BM25 + cosine via RRF).",
      "                      This is the server default.",
      "  --semantic          Force pure cosine retrieval for diagnostics/evals.",
      "",
      "Example:",
      '  memlin resolve "wire OAuth callback between API and SPA"'
    ].join("\n")
  );
}
function readGitRemote2(cwd) {
  try {
    const url = execSync2("git remote get-url origin", {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8"
    }).trim();
    return normalizeGitRemote(url);
  } catch {
    return null;
  }
}
async function main() {
  const argv = process.argv.slice(2);
  const parsed = parseArgs(argv);
  if ("error" in parsed) {
    if (parsed.error === "help") {
      printHelp();
      process.exit(0);
    }
    console.error(`memlin resolve: ${parsed.error}`);
    printHelp();
    process.exit(2);
  }
  const ctx = await getApi();
  if (!ctx) {
    console.error("memlin: not configured. Run `memlin login` first.");
    process.exit(1);
  }
  const { api, config, workspaceBound } = ctx;
  const cwd = runtimeCwd();
  const gitRemote = readGitRemote2(cwd);
  let projectId;
  let accountOverride = null;
  let resolvedAccountId = null;
  if (parsed.project !== void 0) {
    projectId = parsed.project;
  } else {
    const resolved = await resolveProject(api, cwd, config.project_id);
    projectId = resolved.project_id;
    resolvedAccountId = resolved.account_id;
    if (resolved.account_id && resolved.account_id !== config.account_id) {
      accountOverride = resolved.account_id;
    }
  }
  const explicitProject = parsed.project !== void 0;
  const active = explicitProject || isWorkspaceActive({
    resolvedProjectId: projectId,
    workspaceBound
  });
  if (!active) {
    if (process.stderr.isTTY) {
      console.error(
        "memlin resolve: this directory isn't a known Memlin workspace. Run `memlin link --account <name>` to enable it, or `memlin link --list` to see your accounts."
      );
    }
    process.exit(0);
  }
  void resolvedAccountId;
  let result;
  try {
    result = await api.resolve(
      {
        task: parsed.task,
        project_id: projectId,
        // Forward the caller's environment context so the server can infer the
        // active component. The resolver tolerates either being null (just falls
        // back to project-wide ranking).
        cwd,
        git_remote: gitRemote,
        ...parsed.maxTokens !== void 0 ? { max_tokens: parsed.maxTokens } : {},
        ...parsed.kinds ? { kinds: parsed.kinds } : {},
        ...parsed.hybrid !== void 0 ? { hybrid: parsed.hybrid } : {},
        // The agent's session id (set by the UserPromptSubmit hook) — lets
        // the resolve's usage_event be attributed to this session.
        ...process.env.MEMLIN_SESSION_ID ? { session_id: process.env.MEMLIN_SESSION_ID } : {}
      },
      accountOverride ? { accountId: accountOverride } : {}
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("EMBEDDING_UNAVAILABLE") || msg.includes("503")) {
      console.error(
        `memlin resolve: server-side embeddings unavailable (${msg}). The resolver requires OPENAI_API_KEY on the Memlin server. Contact your admin or use the hosted memlin.ai endpoint.`
      );
      process.exit(3);
    }
    console.error(`memlin resolve failed: ${msg}`);
    process.exit(1);
  }
  const outString = compileBundle(result, parsed.task, parsed.agent);
  process.stdout.write(outString);
  if (result.audit_id) {
    const bundleHasContent = Boolean(result.bundle.primary_skill) || result.bundle.supporting_skills.length > 0 || result.bundle.memory.length > 0 || result.bundle.goals.length > 0 || result.bundle.schemas.length > 0 || (result.bundle.decisions?.length ?? 0) > 0 || (result.bundle.pinned?.length ?? 0) > 0;
    await recordLastResolve({
      task: parsed.task,
      audit_id: result.audit_id,
      resolved_at: Date.now(),
      cwd,
      had_content: bundleHasContent,
      // Every adapter spawns this CLI with MEMLIN_HOST set; the Claude Code
      // plugin is the unset default. The continuity check matches on this so
      // hosts never consume each other's cache entries.
      host: process.env.MEMLIN_HOST ?? "claude-code"
    });
  }
}
main().catch((err) => {
  console.error("memlin resolve failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
