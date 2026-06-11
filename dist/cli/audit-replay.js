#!/usr/bin/env node
import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);

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

// packages/plugin-core/src/cli/args.ts
function parseSlashArgs(raw) {
  const tokens = [];
  let cur = "";
  let inSingle = false;
  let inDouble = false;
  let started = false;
  let i = 0;
  const flush = () => {
    if (started) {
      tokens.push(cur);
      cur = "";
      started = false;
    }
  };
  while (i < raw.length) {
    const ch = raw[i];
    if (inSingle) {
      if (ch === "'") {
        inSingle = false;
      } else {
        cur += ch;
      }
      i++;
      continue;
    }
    if (inDouble) {
      if (ch === "\\" && i + 1 < raw.length) {
        const next = raw[i + 1];
        if (next === '"' || next === "\\") {
          cur += next;
          i += 2;
          continue;
        }
        cur += ch;
        i++;
        continue;
      }
      if (ch === '"') {
        inDouble = false;
        i++;
        continue;
      }
      cur += ch;
      i++;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      started = true;
      i++;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      started = true;
      i++;
      continue;
    }
    if (ch === " " || ch === "	" || ch === "\n") {
      flush();
      i++;
      continue;
    }
    cur += ch;
    started = true;
    i++;
  }
  flush();
  return tokens;
}
function argvAsSlashArgs() {
  const raw = process.argv.slice(2).join(" ").trim();
  return parseSlashArgs(raw);
}

// packages/plugin-core/src/cli/audit-replay.ts
function parseArgs(argv) {
  const positional = [];
  for (const a of argv) {
    if (a === "--help" || a === "-h") return { error: "help" };
    if (a?.startsWith("--")) return { error: `unknown flag: ${a}` };
    if (a) positional.push(a);
  }
  const auditId = positional[0];
  if (!auditId) return { error: "missing audit id. usage: memlin audit replay <id>" };
  if (!/^[0-9a-f-]{36}$/i.test(auditId)) {
    return { error: `audit id should be a uuid (got "${auditId}")` };
  }
  return { auditId };
}
function printHelp() {
  console.log(
    [
      "memlin audit replay \u2014 re-render the exact bundle a past resolve served",
      "",
      "Usage:",
      "  memlin audit replay <audit-id>",
      "",
      "Example:",
      "  memlin audit replay 1f399e7b-1da2-47f3-ae06-d1e6967fee4e"
    ].join("\n")
  );
}
function driftBadge(item) {
  if (!item.drift.drifted) return "";
  const head = item.drift.current_version_number;
  return head != null ? ` (head is now v${head} \u2014 drift)` : " (drift)";
}
function labelFor(item) {
  if (item.role === "primary") return "PRIMARY SKILL";
  if (item.role === "supporting") return "SUPPORTING SKILL";
  if (item.kind === "goal") return "GOAL";
  if (item.kind === "schema") return "SCHEMA";
  if (item.kind === "memory") return "MEMORY";
  return item.kind.toUpperCase();
}
function renderItem(item) {
  const lines = [];
  const meta = [`similarity ${item.similarity.toFixed(2)}`, `rank ${item.rank}`];
  if (item.component_name) meta.push(`component: ${item.component_name}`);
  lines.push(`## ${labelFor(item)}: ${item.title} (${meta.join(", ")})`);
  const cite = [];
  cite.push(item.path ?? "(no path)");
  cite.push(`v${item.version_number}${driftBadge(item)}`);
  if (item.author_id) cite.push(item.author_id.slice(0, 8));
  lines.push(`# source: ${cite.join(" \xB7 ")}`);
  lines.push("");
  lines.push(item.content.trimEnd());
  lines.push("");
  return lines.join("\n");
}
async function main() {
  const parsed = parseArgs(argvAsSlashArgs());
  if ("error" in parsed) {
    if (parsed.error === "help") {
      printHelp();
      process.exit(0);
    }
    console.error(`memlin audit replay: ${parsed.error}`);
    printHelp();
    process.exit(2);
  }
  const ctx = await getApi();
  if (!ctx) {
    console.error("memlin: not configured. Run `memlin login` first.");
    process.exit(1);
  }
  let replay;
  try {
    replay = await ctx.api.replayAudit(parsed.auditId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`memlin audit replay failed: ${msg}`);
    process.exit(1);
  }
  const out = [];
  out.push(`# Memlin Audit Replay \u2014 resolved ${replay.resolved_at}`);
  out.push(`# audit_id: ${replay.audit_id}`);
  out.push(`# task: ${replay.task}`);
  out.push(`# agent: ${replay.agent_kind ?? "(unknown)"}`);
  if (replay.cwd) out.push(`# cwd: ${replay.cwd}`);
  if (replay.git_remote) out.push(`# git_remote: ${replay.git_remote}`);
  if (replay.active_component_id) {
    out.push(`# active component: ${replay.active_component_id}`);
  }
  const tb = replay.token_budget;
  out.push(
    `# tokens: ${tb.used.toLocaleString()} / ${tb.limit.toLocaleString()}` + (tb.truncated ? " (truncated)" : "")
  );
  if (!replay.from_snapshot) {
    out.push(
      "# WARNING: this audit pre-dates version snapshotting \u2014 items reflect",
      "# the CURRENT head version, not the version the agent saw at resolve",
      "# time. Drift detection is unreliable for this row. Newer resolves",
      "# capture version_number per item and replay with full accuracy."
    );
  }
  if (replay.drift_detected) {
    out.push(
      "# DRIFT DETECTED \u2014 one or more items have changed since this resolve.",
      '#   See per-item "head is now vN" annotations below.'
    );
  }
  out.push("");
  if (replay.brand_guidelines) {
    const bg = replay.brand_guidelines;
    out.push(`## BRAND GUIDELINES at resolve time (${bg.source ?? "account"})`);
    const cite = `brand-guidelines://${bg.id} \xB7 ${bg.updated_at_at_resolve ?? "(unknown)"}` + (bg.drifted ? ` \xB7 DRIFT (current updated_at: ${bg.current_updated_at})` : "");
    out.push(`# source: ${cite}`);
    out.push("");
  }
  if (replay.pinned && replay.pinned.length > 0) {
    out.push("## STANDING DIRECTIVES (pinned at resolve time)");
    out.push("# Force-included regardless of similarity \u2014 these outranked retrieved context.");
    out.push("");
    for (const item of replay.pinned) {
      out.push(renderItem(item));
    }
  }
  if (replay.items.length === 0) {
    out.push("# (no items above threshold at resolve time)");
  } else {
    for (const item of replay.items) {
      out.push(renderItem(item));
    }
  }
  process.stdout.write(out.join("\n") + "\n");
  process.exit(replay.from_snapshot ? 0 : 3);
}
main().catch((err) => {
  console.error("memlin audit replay failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
