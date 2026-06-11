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
   *  tool.guardrail, action.invoke) and re-derives account_id and
   *  user_id from the auth context so callers can't forge rows for
   *  other workspaces. */
  async writeUsageEvent(input) {
    return this.request("POST", "/usage/event", input);
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
  let workspaceBound = false;
  let workspaceRoot = null;
  const overlay = await findWorkspaceBinding(cwd);
  if (overlay && overlay.binding.account_id !== config.account_id) {
    config.account_id = overlay.binding.account_id;
    if (overlay.binding.project_id !== void 0) {
      config.project_id = overlay.binding.project_id;
    }
    workspaceBound = true;
    workspaceRoot = overlay.workspaceRoot;
  }
  const apiUrl = process.env.MEMLIN_API_URL?.trim() || config.api_url || resolveApiUrl();
  const api = new MemlinApiClient({
    baseUrl: apiUrl,
    getAccessToken: getValidAccessToken,
    accountId: config.account_id
  });
  return { api, config, workspaceBound, workspaceRoot };
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

// packages/plugin-core/src/cli/inbox.ts
function titleFromInsight(insight) {
  const evidenceTitle = insight.evidence?.title;
  if (typeof evidenceTitle === "string" && evidenceTitle.trim()) return evidenceTitle.trim();
  const suggestionTitle = insight.suggestion?.title;
  if (typeof suggestionTitle === "string" && suggestionTitle.trim()) return suggestionTitle.trim();
  return "(untitled insight)";
}
async function loadPending(api) {
  const [inbox, { insights }] = await Promise.all([
    api.listInbox(),
    api.listInsights({ kind: "memory_proposal", status: "pending", limit: 100 })
  ]);
  const { proposals, recent_corrections = [] } = inbox;
  return [
    ...proposals.map(
      (p) => ({
        source: "document",
        id: p.id,
        kind: p.kind,
        title: p.title,
        confidence: p.confidence,
        memory_type: p.memory_type ?? null,
        overlaps: (p.overlap_candidates ?? []).map((c) => ({
          shortId: c.id.slice(0, 8),
          title: c.title,
          similarity: c.similarity
        })),
        blocked: p.promotion_blocked_by === "overlap_candidates"
      })
    ),
    ...insights.map(
      (i) => ({
        source: "insight",
        id: i.id,
        kind: "memory",
        title: titleFromInsight(i),
        confidence: i.confidence,
        overlaps: [],
        blocked: false
      })
    ),
    // Already-active correction rules captured recently. Included in the match
    // pool so `reject <id>` undoes them; rendered in their own section.
    ...recent_corrections.map(
      (p) => ({
        source: "document",
        id: p.id,
        kind: p.kind,
        title: p.title,
        confidence: p.confidence,
        memory_type: "correction",
        overlaps: [],
        blocked: false,
        recent: true
      })
    )
  ];
}
function kindLabel(p) {
  if (p.kind === "memory" && p.memory_type) return `${p.kind}:${p.memory_type}`;
  return p.kind;
}
async function listInbox(api) {
  const all = await loadPending(api);
  const pending = all.filter((p) => !p.recent);
  const recent = all.filter((p) => p.recent);
  if (pending.length === 0 && recent.length === 0) {
    process.stdout.write("Inbox clear \u2014 no proposals waiting.\n");
    return;
  }
  let anyOverlaps = false;
  if (pending.length > 0) {
    process.stdout.write(
      `${pending.length} proposal${pending.length === 1 ? "" : "s"} waiting:

`
    );
    for (const p of pending) {
      const conf = p.confidence != null ? `  ${Math.round(p.confidence * 100)}%` : "";
      const source = p.source === "insight" ? "auto" : "scribe";
      const blockedMarker = p.blocked ? "  \u2691 overlap-held" : "";
      process.stdout.write(
        `  ${p.id.slice(0, 8)}  ${source.padEnd(6)} ${kindLabel(p).padEnd(18)}${p.title}${conf}${blockedMarker}
`
      );
      if (p.overlaps.length > 0) {
        anyOverlaps = true;
        for (const o of p.overlaps) {
          process.stdout.write(
            `             \u2194 overlaps ${o.shortId}  ${o.title}  (sim ${o.similarity.toFixed(2)})
`
          );
        }
      }
    }
  }
  if (recent.length > 0) {
    process.stdout.write(
      `${pending.length > 0 ? "\n" : ""}\u26A1 Recently captured (already active \u2014 reject to undo):

`
    );
    for (const p of recent) {
      process.stdout.write(`  ${p.id.slice(0, 8)}  correction  ${p.title}
`);
    }
  }
  process.stdout.write(
    "\nResolve one:  /memlin-inbox accept <id>   \xB7   /memlin-inbox reject <id>\n(<id> is the 8-char prefix shown above)\n"
  );
  if (anyOverlaps) {
    process.stdout.write(
      "\n\u2691 overlap-held items overlap existing approved memory.\n  Compare both bodies before accepting; if the new one supersedes the\n  old, reject this proposal and use /memlin-revert on the old doc, or\n  accept this and archive the old one from the workspace.\n"
    );
  }
}
function matchProposal(proposals, needle) {
  const exact = proposals.find((p) => p.id === needle);
  if (exact) return exact;
  const matches = proposals.filter((p) => p.id.startsWith(needle));
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) {
    return { error: `no pending proposal matches "${needle}"` };
  }
  return {
    error: `"${needle}" is ambiguous \u2014 matches ${matches.length} proposals; use more characters`
  };
}
async function main() {
  const ctx = await getApi();
  if (!ctx) {
    process.stderr.write("not signed in \u2014 run /memlin-login first\n");
    process.exit(1);
  }
  const args = argvAsSlashArgs();
  const action = args[0];
  if (!action) {
    await listInbox(ctx.api);
    return;
  }
  if (action !== "accept" && action !== "reject") {
    process.stderr.write(
      `unknown action "${action}" \u2014 use: accept <id> | reject <id>, or no args to list
`
    );
    process.exit(1);
  }
  const needle = args[1];
  if (!needle) {
    process.stderr.write(`missing proposal id \u2014 usage: /memlin-inbox ${action} <id>
`);
    process.exit(1);
  }
  const pending = await loadPending(ctx.api);
  const match = matchProposal(pending, needle);
  if ("error" in match) {
    process.stderr.write(`${match.error}
`);
    process.exit(2);
  }
  if (match.source === "insight") {
    const result2 = await ctx.api.resolveInsight(
      match.id,
      action === "accept" ? "accept" : "dismiss"
    );
    const verb2 = result2.status === "accepted" ? "Accepted" : "Rejected";
    process.stdout.write(`\u2713 ${verb2} \u2014 "${match.title}" (${match.kind})
`);
    if (result2.status === "accepted") {
      process.stdout.write("  Saved as memory \u2014 the resolver will surface it after embedding.\n");
    }
    return;
  }
  const result = await ctx.api.resolveProposal(match.id, action);
  const verb = result.status === "active" ? "Accepted" : "Rejected";
  process.stdout.write(`\u2713 ${verb} \u2014 "${match.title}" (${match.kind})
`);
  if (result.status === "active") {
    process.stdout.write("  Now active \u2014 the resolver will surface it.\n");
  }
}
main().catch((err) => {
  process.stderr.write(
    `memlin inbox failed: ${err instanceof Error ? err.message : String(err)}
`
  );
  process.exit(1);
});
