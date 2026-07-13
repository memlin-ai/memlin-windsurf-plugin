#!/usr/bin/env node
import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);
import { fileURLToPath as __ftp } from 'node:url'; import { dirname as __dn } from 'node:path';
const __filename = __ftp(import.meta.url); const __dirname = __dn(__filename);
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// packages/plugin-core/src/companion-client.ts
var companion_client_exports = {};
__export(companion_client_exports, {
  COMPANION_PROTOCOL: () => COMPANION_PROTOCOL,
  COMPANION_SOCKET_ENV: () => COMPANION_SOCKET_ENV,
  IS_COMPANION_ENV: () => IS_COMPANION_ENV,
  MAX_COMPANION_PROTOCOL: () => MAX_COMPANION_PROTOCOL,
  MIN_COMPANION_PROTOCOL: () => MIN_COMPANION_PROTOCOL,
  NO_COMPANION_ENV: () => NO_COMPANION_ENV,
  USE_COMPANION_ENV: () => USE_COMPANION_ENV,
  companionDelegationEnabled: () => companionDelegationEnabled,
  companionForDelegation: () => companionForDelegation,
  companionGetToken: () => companionGetToken,
  companionReportSession: () => companionReportSession,
  companionRequest: () => companionRequest,
  companionResolveWorkspace: () => companionResolveWorkspace,
  companionRunDir: () => companionRunDir,
  companionSocketPath: () => companionSocketPath,
  companionStatus: () => companionStatus,
  companionSyncNow: () => companionSyncNow,
  isCompanionHealthyForDelegation: () => isCompanionHealthyForDelegation,
  resetCompanionClientCache: () => resetCompanionClientCache
});
import http from "node:http";
import os from "node:os";
import path from "node:path";
function companionSocketPath(env = process.env) {
  const override = env[COMPANION_SOCKET_ENV];
  if (override) return override;
  if (process.platform === "win32") {
    return `\\\\.\\pipe\\memlin-companion-${os.userInfo().username}`;
  }
  return path.join(os.homedir(), ".config", "memlin", "run", "companion.sock");
}
function companionRunDir() {
  return path.join(os.homedir(), ".config", "memlin", "run");
}
function companionDisabled(env = process.env) {
  const off = env[NO_COMPANION_ENV];
  if (off === "1" || off === "true" || off === "yes") return true;
  return env[IS_COMPANION_ENV] === "1";
}
async function companionRequest(method, body, opts = {}) {
  const env = opts.env ?? process.env;
  if (companionDisabled(env)) return null;
  if (Date.now() < socketDeadUntil) return null;
  const timeoutMs = opts.timeoutMs ?? CALL_TIMEOUTS[method] ?? DEFAULT_CALL_TIMEOUT_MS;
  const payload = JSON.stringify(body ?? {});
  return new Promise((resolve) => {
    let settled = false;
    const fail = (markDead) => {
      if (settled) return;
      settled = true;
      if (markDead) socketDeadUntil = Date.now() + SOCKET_DEAD_TTL_MS;
      resolve(null);
    };
    const req = http.request(
      {
        socketPath: companionSocketPath(env),
        path: `/v1/${method}`,
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(payload),
          "memlin-client-protocol": String(COMPANION_PROTOCOL)
        },
        // Overall call budget; the connect phase gets its own tighter cap
        // below via the socket timeout before the connection exists.
        timeout: timeoutMs
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          if (settled) return;
          settled = true;
          if (res.statusCode !== 200) return resolve(null);
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch {
            resolve(null);
          }
        });
        res.on("error", () => fail(false));
      }
    );
    const connectTimer = setTimeout(() => {
      req.destroy();
      fail(true);
    }, CONNECT_TIMEOUT_MS);
    connectTimer.unref?.();
    req.on("socket", (socket) => {
      socket.once("connect", () => clearTimeout(connectTimer));
    });
    req.on("timeout", () => {
      req.destroy();
      fail(false);
    });
    req.on("error", () => fail(true));
    req.end(payload);
  });
}
async function companionStatus() {
  const status = await companionRequest("status.get", {});
  if (!status) return null;
  if (status.protocol < MIN_COMPANION_PROTOCOL || status.protocol > MAX_COMPANION_PROTOCOL) {
    return null;
  }
  return status;
}
async function companionGetToken() {
  const token = await companionRequest("token.get", {});
  if (!token || token.expires_at <= Date.now() + 6e4) return null;
  return token;
}
async function companionResolveWorkspace(cwd) {
  return companionRequest("workspace.resolve", { cwd });
}
async function companionSyncNow(req) {
  return companionRequest("sync.now", req);
}
async function companionReportSession(req) {
  return (await companionRequest("session.report", req))?.registered ?? false;
}
function isCompanionHealthyForDelegation(status) {
  if (!status) return false;
  if (status.auth.state !== "ok") return false;
  if (status.sync.mode === "realtime") return true;
  if (status.sync.mode !== "polling") return false;
  if (!status.sync.last_delta_at) return false;
  const age = Date.now() - Date.parse(status.sync.last_delta_at);
  return Number.isFinite(age) && age < 5 * 6e4;
}
function companionDelegationEnabled(env = process.env) {
  const v = env[USE_COMPANION_ENV];
  return v === "1" || v === "true" || v === "yes";
}
async function companionForDelegation() {
  if (!companionDelegationEnabled()) return null;
  const status = await companionStatus();
  return isCompanionHealthyForDelegation(status) ? status : null;
}
function resetCompanionClientCache() {
  socketDeadUntil = 0;
}
var COMPANION_PROTOCOL, MIN_COMPANION_PROTOCOL, MAX_COMPANION_PROTOCOL, NO_COMPANION_ENV, IS_COMPANION_ENV, COMPANION_SOCKET_ENV, CONNECT_TIMEOUT_MS, DEFAULT_CALL_TIMEOUT_MS, CALL_TIMEOUTS, socketDeadUntil, SOCKET_DEAD_TTL_MS, USE_COMPANION_ENV;
var init_companion_client = __esm({
  "packages/plugin-core/src/companion-client.ts"() {
    "use strict";
    COMPANION_PROTOCOL = 1;
    MIN_COMPANION_PROTOCOL = 1;
    MAX_COMPANION_PROTOCOL = 1;
    NO_COMPANION_ENV = "MEMLIN_NO_DAEMON";
    IS_COMPANION_ENV = "MEMLIN_DAEMON";
    COMPANION_SOCKET_ENV = "MEMLIN_COMPANION_SOCKET";
    CONNECT_TIMEOUT_MS = 150;
    DEFAULT_CALL_TIMEOUT_MS = 1e3;
    CALL_TIMEOUTS = {
      "workspace.resolve": 2e3,
      "sync.now": 5e3,
      "login.start": 1e4
    };
    socketDeadUntil = 0;
    SOCKET_DEAD_TTL_MS = 5e3;
    USE_COMPANION_ENV = "MEMLIN_USE_DAEMON";
  }
});

// packages/plugin-core/src/cli/bind-plans.ts
import path9 from "node:path";
import os7 from "node:os";
import { execSync as execSync2 } from "node:child_process";

// packages/plugin-core/src/client.ts
import { promises as fs3 } from "node:fs";
import path5 from "node:path";
import os5 from "node:os";

// packages/plugin-core/src/auth.ts
import { promises as fs } from "node:fs";
import path2 from "node:path";
import os2 from "node:os";
var MEMLIN_PROD_AUTH0_DOMAIN = "memlin.us.auth0.com";
var MEMLIN_PROD_AUTH0_CLIENT_ID = "fyYMQ4Cxc6Nu5juVwL8Ihqq4fgAFecG9";
var AUTH0_DOMAIN = process.env.MEMLIN_AUTH0_DOMAIN || MEMLIN_PROD_AUTH0_DOMAIN;
var AUTH0_CLIENT_ID = process.env.MEMLIN_AUTH0_CLIENT_ID || MEMLIN_PROD_AUTH0_CLIENT_ID;
var AUTH0_AUDIENCE = process.env.MEMLIN_AUTH0_AUDIENCE ?? "https://api.memlin.ai";
function tokenFilePath() {
  return process.env.MEMLIN_TOKEN_FILE || path2.join(os2.homedir(), ".config", "memlin", "token.json");
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
  await fs.mkdir(path2.dirname(file), { recursive: true });
  const tmp = path2.join(path2.dirname(file), `token.json.tmp-${process.pid}`);
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
var DEFAULT_FRESHNESS_MARGIN_MS = 6e4;
async function getValidAccessToken() {
  return ensureFreshToken(DEFAULT_FRESHNESS_MARGIN_MS);
}
async function ensureFreshToken(marginMs = DEFAULT_FRESHNESS_MARGIN_MS) {
  const persisted = await readPersistedToken();
  if (!persisted) throw new Error("not signed in \u2014 run `memlin login`");
  if (Date.now() < persisted.expires_at - marginMs) return persisted.access_token;
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = doRefresh(persisted, marginMs).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}
async function doRefresh(stale, marginMs) {
  const latest = await readPersistedToken();
  if (latest && Date.now() < latest.expires_at - marginMs) return latest.access_token;
  try {
    const { companionGetToken: companionGetToken2 } = await Promise.resolve().then(() => (init_companion_client(), companion_client_exports));
    const fromDaemon = await companionGetToken2();
    if (fromDaemon && Date.now() < fromDaemon.expires_at - marginMs) {
      return fromDaemon.access_token;
    }
  } catch {
  }
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
import { readFileSync } from "node:fs";
import os4 from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
  // VS Code (apps/vscode-extension): MCP + CLI + copilot-instructions; plain
  // VS Code has no lifecycle-hook or slash-command surface.
  vscode: ["mcp", "cli", "rules", "resolve"],
  gemini: ["mcp", "rules", "resolve"],
  grok: ["mcp", "rules", "resolve"],
  hermes: ["mcp", "resolve"],
  openclaw: ["mcp", "rules", "resolve"],
  antigravity: ["mcp", "cli", "hooks", "commands", "rules", "sync", "scribe", "resolve"],
  mcp: ["mcp", "resolve"],
  "claude-ai": ["mcp", "resolve"],
  // Companion daemon (apps/companion): background token keeper + realtime
  // plan sync + local IPC socket other agents delegate to. No hooks/commands
  // of its own.
  companion: ["cli", "sync", "realtime", "resolve"]
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
import os3 from "node:os";
import path3 from "node:path";
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
    return path3.join(this.home, "plans");
  }
};
var ClaudeCodeHost = class extends BaseHost {
  constructor() {
    super("claude-code", path3.join(os3.homedir(), ".claude"));
  }
};
var CursorHost = class extends BaseHost {
  constructor() {
    super("cursor", path3.join(os3.homedir(), ".config", "memlin"));
  }
};
var CodexHost = class extends BaseHost {
  constructor() {
    super("codex", path3.join(os3.homedir(), ".config", "memlin"));
  }
};
var WindsurfHost = class extends BaseHost {
  constructor() {
    super("windsurf", path3.join(os3.homedir(), ".config", "memlin"));
  }
};
var AntigravityHost = class extends BaseHost {
  constructor() {
    super("antigravity", path3.join(os3.homedir(), ".config", "memlin"));
  }
};
var VSCodeHost = class extends BaseHost {
  constructor() {
    super("vscode", path3.join(os3.homedir(), ".config", "memlin"));
  }
};
var CompanionHost = class extends BaseHost {
  constructor() {
    super("companion", path3.join(os3.homedir(), ".config", "memlin"));
  }
};
var HOSTS = {
  "claude-code": () => new ClaudeCodeHost(),
  cursor: () => new CursorHost(),
  codex: () => new CodexHost(),
  windsurf: () => new WindsurfHost(),
  antigravity: () => new AntigravityHost(),
  vscode: () => new VSCodeHost(),
  companion: () => new CompanionHost()
};
function resolveHost() {
  const envHost = "windsurf";
  const make = HOSTS[envHost];
  return (make ?? HOSTS["claude-code"])();
}

// packages/plugin-core/src/memlin-api-client.ts
var DEFAULT_API_URL = "https://memlin.ai/api/v1";
function agentDevice() {
  return process.env.MEMLIN_AGENT_DEVICE || os4.hostname() || "unknown";
}
var cachedAgentVersion = null;
function agentVersion() {
  if (cachedAgentVersion) return cachedAgentVersion;
  cachedAgentVersion = "0.1.33";
  return cachedAgentVersion;
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
   * GET /realtime/config — Supabase connection info for the caller's
   * effective account. The client config file is deliberately
   * backend-agnostic (no Supabase URL / anon key), so Realtime subscribers
   * — the Companion daemon (packages/companion-core) — bootstrap the
   * connection from here. Dedicated-instance (paid org) accounts get THEIR
   * instance's values, which is why this rides normal account-header auth.
   */
  async getRealtimeConfig(opts = {}) {
    return this.request("GET", "/realtime/config", void 0, { accountId: opts.accountId });
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
   *  tool.guardrail, action.invoke, resolve.outcome, edit.activity,
   *  resolve.delivery) and re-derives account_id and user_id from the auth
   *  context so callers can't forge rows for other workspaces.
   *  `opts.accountId` routes the write to a non-default account
   *  (multi-account workspaces). */
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
  /** Atomically compare-and-sync the server-owned project CONTRACT.md. */
  async syncWorkspaceContract(input) {
    return this.request("POST", "/workspace-contract/sync", input);
  }
  /** GET /documents/{id} — fetch one doc with body + metadata. */
  async getDocument(documentId) {
    return this.request("GET", `/documents/${encodeURIComponent(documentId)}`);
  }
  /** POST /documents/{id}/contract-verification — H12. Record a contract
   *  check. Used by `memlin diff --record`. */
  async recordContractVerification(documentId, body) {
    return this.request(
      "POST",
      `/documents/${encodeURIComponent(documentId)}/contract-verification`,
      body
    );
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
  async listFeatures(opts = {}) {
    const qs = new URLSearchParams();
    if (opts.project_id) qs.set("project_id", opts.project_id);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return this.request("GET", `/features${suffix}`);
  }
  async createFeature(input) {
    return this.request("POST", "/features", input);
  }
  async addFeatureMember(featureId, source) {
    return this.request("POST", `/features/${featureId}/members`, { source });
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
  /**
   * POST /edit-guard — real-time, pre-edit file-collision check.
   *
   * The PreToolUse hook calls this before an Edit/Write/MultiEdit, passing the
   * repo-relative path(s) about to change. The server reads the same
   * `edit.activity` feed the resolver's recent_file_edits uses and returns any
   * LIVE collisions — other sessions that edited the same path within the last
   * ~10 min — so the hook can warn or block. Read-only; never mutates.
   * project_id is passed explicitly (the hook resolves it from cwd first).
   */
  async editGuard(input, opts = {}) {
    return this.request("POST", "/edit-guard", input, { accountId: opts.accountId });
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
   * POST /memory/ingest-native — ingest a host's native auto-memory.
   *
   * Sends the raw native MEMORY.md index (+ the satellite filenames the
   * adapter already pulls) so the server parses it and runs the entries
   * through the scribe dedup (corroborate, don't duplicate). Makes turning
   * off native auto-memory lossless.
   */
  async ingestNativeMemory(input, opts = {}) {
    return this.request("POST", "/memory/ingest-native", input, { accountId: opts.accountId });
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
  /** POST /decisions/{id}/verify — record an outcome on the decision
   *  ledger. Verdicts surface on every future resolve of the decision. */
  async verifyDecision(decisionId, input, opts = {}) {
    return this.request("POST", `/decisions/${encodeURIComponent(decisionId)}/verify`, input, {
      accountId: opts.accountId
    });
  }
  /** GET /decisions/review-due — decisions whose review date arrived. */
  async listReviewDueDecisions(opts = {}) {
    const qs = opts.projectId ? `?project_id=${encodeURIComponent(opts.projectId)}` : "";
    return this.request("GET", `/decisions/review-due${qs}`, void 0, {
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
import { randomUUID } from "node:crypto";
import { promises as fs2 } from "node:fs";
import path4 from "node:path";
var WORKSPACE_DIR_NAME = ".memlin";
var WORKSPACE_BINDING_FILE = "config.json";
async function findWorkspaceBinding(startDir) {
  let dir = path4.resolve(startDir);
  for (let i = 0; i < 64; i++) {
    const candidate = path4.join(dir, WORKSPACE_DIR_NAME, WORKSPACE_BINDING_FILE);
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
    const parent = path4.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

// packages/plugin-core/src/client.ts
var CONFIG_DIR = path5.join(os5.homedir(), ".config", "memlin");
var CONFIG_FILE = path5.join(CONFIG_DIR, "config.json");
var TOKEN_FILE = path5.join(CONFIG_DIR, "token.json");
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
import { existsSync, readdirSync } from "node:fs";
import path6 from "node:path";
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
    if (raw && path6.isAbsolute(raw)) return path6.resolve(raw);
  }
  return path6.resolve(fallback);
}
async function resolveProject(api, cwd, configProjectId) {
  const absCwd = path6.resolve(cwd);
  const remotes = detectGitRemotes(cwd);
  const hasGitRemote = remotes.length > 0;
  try {
    const result = await api.resolveProject({
      // Primary remote (back-compat with the single-remote server path).
      git_remote: remotes[0] ?? null,
      // All detected remotes — for the workspace-root-of-repos case, this is
      // every sibling repo so the server resolves to the owning project.
      git_remotes: remotes,
      cwd: absCwd
    });
    if (result.project_id) {
      return {
        project_id: result.project_id,
        project_name: result.name,
        account_id: result.account_id,
        reason: result.reason === "none" ? "config" : result.reason,
        hasGitRemote
      };
    }
  } catch {
  }
  if (configProjectId) {
    return {
      project_id: configProjectId,
      project_name: null,
      account_id: null,
      reason: "config",
      hasGitRemote
    };
  }
  return { project_id: null, project_name: null, account_id: null, reason: "none", hasGitRemote };
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
var MAX_WORKSPACE_SCAN = 64;
function detectGitRemotes(cwd) {
  const enclosing = readGitRemote(cwd);
  if (enclosing) return [enclosing];
  const out = [];
  try {
    let scanned = 0;
    for (const entry of readdirSync(cwd, { withFileTypes: true })) {
      if (scanned >= MAX_WORKSPACE_SCAN) break;
      if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules") {
        continue;
      }
      scanned++;
      const child = path6.join(cwd, entry.name);
      if (!existsSync(path6.join(child, ".git"))) continue;
      const remote = readGitRemote(child);
      if (remote && !out.includes(remote)) out.push(remote);
    }
  } catch {
  }
  return out;
}

// packages/plugin-core/src/plan-sync.ts
import { promises as fs5 } from "node:fs";
import path8 from "node:path";

// packages/plugin-core/src/state.ts
import { promises as fs4 } from "node:fs";
import path7 from "node:path";
import os6 from "node:os";
import crypto from "node:crypto";
var STATE_FILE = path7.join(os6.homedir(), ".config", "memlin", "state.json");
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
  await fs4.mkdir(path7.dirname(STATE_FILE), { recursive: true });
  const tmp = `${STATE_FILE}.${process.pid}.tmp`;
  await fs4.writeFile(tmp, JSON.stringify(state, null, 2), "utf8");
  await fs4.rename(tmp, STATE_FILE);
}
var LOCK_DIR = `${STATE_FILE}.lock`;
var LOCK_STALE_MS = 2e3;
var LOCK_WAIT_MS = 2e3;
var LOCK_RETRY_MS = 50;
async function acquireStateLock() {
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (; ; ) {
    try {
      await fs4.mkdir(LOCK_DIR);
      return true;
    } catch {
      try {
        const stat = await fs4.stat(LOCK_DIR);
        if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
          await fs4.rmdir(LOCK_DIR).catch(() => {
          });
          continue;
        }
      } catch {
        continue;
      }
      if (Date.now() >= deadline) return false;
      await new Promise((r) => setTimeout(r, LOCK_RETRY_MS));
    }
  }
}
async function releaseStateLock() {
  await fs4.rmdir(LOCK_DIR).catch(() => {
  });
}
async function updateState(mutate) {
  const locked = await acquireStateLock();
  try {
    const state = await readState();
    await mutate(state);
    await writeState(state);
    return state;
  } finally {
    if (locked) await releaseStateLock();
  }
}
function hash(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

// packages/plugin-core/src/plan-sync.ts
function homeBase(host) {
  return (host ?? resolveHost()).homeDir();
}
function plansDir(host) {
  return (host ?? resolveHost()).plansDir();
}
function resolveTargetDocId(stateEntry, binding) {
  return stateEntry?.document_id || binding?.documentId || void 0;
}
async function pushPlanFile(api, file, opts = {}) {
  const raw = await fs5.readFile(file, "utf8");
  const { title, body, binding: existingBinding } = parsePlanFile(raw);
  if (!body.trim()) {
    throw new Error("plan body is empty");
  }
  const relPath = path8.relative(homeBase(opts.host), file);
  const state = await readState();
  const existing = state.documents[relPath];
  const targetDocId = resolveTargetDocId(existing, existingBinding);
  if (targetDocId) {
    const result2 = await api.updatePlan(targetDocId, {
      body,
      title,
      commit_message: "edit from claude-code"
    });
    await stampPlanFile(file, {
      documentId: result2.document_id,
      projectId: existingBinding?.projectId ?? null
    });
    const stampedUpdate = await fs5.readFile(file, "utf8").catch(() => raw);
    await updateState((s) => {
      s.documents[relPath] = {
        document_id: result2.document_id,
        version_id: existing?.version_id ?? "",
        version_number: result2.version_number,
        content_hash: hash(stampedUpdate),
        last_synced_at: (/* @__PURE__ */ new Date()).toISOString(),
        scope: existing?.scope ?? (existingBinding?.projectId ? "project" : "personal"),
        kind: "plan"
      };
    });
    return {
      document_id: result2.document_id,
      version_number: result2.version_number,
      created: false
    };
  }
  const result = await api.pushPlan({
    title,
    body,
    cwd: opts.cwd ?? null,
    git_remote: opts.gitRemote ?? null
  });
  await updateState((s) => {
    s.documents[relPath] = {
      document_id: result.document_id,
      version_id: "",
      version_number: result.version_number,
      content_hash: hash(raw),
      last_synced_at: (/* @__PURE__ */ new Date()).toISOString(),
      scope: result.project_id ? "project" : "personal",
      kind: "plan"
    };
  });
  await stampPlanFile(file, {
    documentId: result.document_id,
    projectId: result.project_id
  });
  const stamped = await fs5.readFile(file, "utf8").catch(() => raw);
  await updateState((s) => {
    const entry = s.documents[relPath];
    if (entry) entry.content_hash = hash(stamped);
  });
  return {
    document_id: result.document_id,
    version_number: result.version_number,
    created: true
  };
}
async function listUnboundPlans(host) {
  const out = [];
  let entries;
  try {
    entries = await fs5.readdir(plansDir(host));
  } catch {
    return out;
  }
  const state = await readState();
  for (const f of entries) {
    if (!f.endsWith(".md")) continue;
    const abs = path8.join(plansDir(host), f);
    let raw;
    let size = 0;
    try {
      const st = await fs5.stat(abs);
      if (!st.isFile() || st.size === 0) continue;
      size = st.size;
      raw = await fs5.readFile(abs, "utf8");
    } catch {
      continue;
    }
    const relPath = path8.relative(homeBase(host), abs);
    const { title, binding } = parsePlanFile(raw);
    if (state.documents[relPath]?.document_id || binding?.documentId) continue;
    out.push({ file: f, title, size });
  }
  return out;
}
async function stampPlanFile(file, binding) {
  let raw;
  try {
    raw = await fs5.readFile(file, "utf8");
  } catch {
    return;
  }
  const parsed = parsePlanFile(raw);
  const stampLine = `<!-- memlin-binding: doc=${binding.documentId} project=${binding.projectId ?? "none"} -->`;
  const bodyNoStamp = parsed.body.replace(/<!--\s*memlin-binding:[^>]*-->\s*\n?/g, "");
  const composed = [
    `# ${parsed.title}`,
    "",
    parsed.status ? `<!-- memlin-plan-status: ${parsed.status} -->` : null,
    stampLine,
    "",
    bodyNoStamp.trim(),
    ""
  ].filter((l) => l !== null).join("\n");
  await fs5.writeFile(file, composed, "utf8");
}
function parsePlanFile(raw) {
  const firstNl = raw.indexOf("\n");
  const first = firstNl === -1 ? raw : raw.slice(0, firstNl);
  const title = first.replace(/^#\s+/, "").trim() || "(untitled plan)";
  const rest = firstNl === -1 ? "" : raw.slice(firstNl + 1).trim();
  const statusMatch = rest.match(/<!--\s*memlin-plan-status:\s*([a-z_]+)\s*-->/);
  const status = statusMatch ? statusMatch[1] ?? null : null;
  const bindMatch = rest.match(/<!--\s*memlin-binding:\s*doc=([0-9a-f-]+)\s+project=(\S+)\s*-->/i);
  const binding = bindMatch ? {
    documentId: bindMatch[1],
    projectId: bindMatch[2] === "none" ? null : bindMatch[2] ?? null
  } : null;
  const body = rest.replace(/<!--\s*memlin-plan-status:[^>]*-->\s*\n?/g, "").replace(/<!--\s*memlin-binding:[^>]*-->\s*\n?/g, "").trim();
  return { title, body, status, binding };
}

// packages/plugin-core/src/cli/bind-plans.ts
var PLANS_DIR = path9.join(os7.homedir(), ".claude", "plans");
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
  const ctx = await getApi();
  if (!ctx) {
    process.stderr.write("not signed in \u2014 run /memlin-login first\n");
    process.exit(1);
  }
  const argv = process.argv.slice(2);
  const all = argv.includes("--all");
  const fileArg = argv.find((a) => !a.startsWith("--"));
  const unbound = await listUnboundPlans();
  if (!all && !fileArg) {
    if (unbound.length === 0) {
      process.stdout.write(
        "No unbound plans \u2014 everything in ~/.claude/plans/ is synced or stamped.\n"
      );
      process.exit(0);
    }
    process.stdout.write(`${unbound.length} unbound plan(s) in ~/.claude/plans/:

`);
    for (const p of unbound) {
      const kb = (p.size / 1024).toFixed(1);
      process.stdout.write(`  ${p.file}  (${kb} KB)
    "${p.title}"
`);
    }
    process.stdout.write(
      "\nThese have no known project. To bind:\n  \u2022 cd into the relevant repo, then: memlin bind-plans <file.md>\n  \u2022 or bind everything to the current repo: memlin bind-plans --all\n\nNothing is sent to Memlin until you bind it.\n"
    );
    process.exit(0);
  }
  const cwd = runtimeCwd();
  const gitRemote = readGitRemote2(cwd);
  let resolved;
  try {
    resolved = await resolveProject(ctx.api, cwd, ctx.config.project_id);
  } catch (err) {
    process.stderr.write(
      `could not resolve a project from ${cwd}: ${err instanceof Error ? err.message : String(err)}
`
    );
    process.exit(1);
  }
  if (!resolved.project_id) {
    process.stderr.write(
      `cwd ${cwd} does not resolve to a known Memlin project.
cd into the repo whose project these plans belong to, then re-run.
`
    );
    process.exit(1);
  }
  const targets = all ? unbound.map((p) => p.file) : [fileArg].map((f) => path9.basename(f));
  if (targets.length === 0) {
    process.stdout.write("Nothing to bind.\n");
    process.exit(0);
  }
  process.stdout.write(
    `Binding ${targets.length} plan(s) to project ${resolved.project_id.slice(0, 8)}\u2026 (${resolved.project_name ?? "unnamed"})
`
  );
  let bound = 0;
  let failed = 0;
  for (const file of targets) {
    const abs = path9.join(PLANS_DIR, file);
    try {
      const result = await pushPlanFile(ctx.api, abs, { cwd, gitRemote });
      process.stdout.write(`  \u2713 ${file} \u2192 ${result.document_id.slice(0, 8)}
`);
      bound += 1;
    } catch (err) {
      process.stderr.write(`  \u2717 ${file}: ${err instanceof Error ? err.message : String(err)}
`);
      failed += 1;
    }
  }
  process.stdout.write(`
done \u2014 bound ${bound}, failed ${failed}.
`);
  process.exit(failed > 0 ? 1 : 0);
}
void main();
