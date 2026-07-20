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
import path2 from "node:path";
function companionSocketPath(env = process.env) {
  const override = env[COMPANION_SOCKET_ENV];
  if (override) return override;
  if (process.platform === "win32") {
    return `\\\\.\\pipe\\memlin-companion-${os.userInfo().username}`;
  }
  return path2.join(os.homedir(), ".config", "memlin", "run", "companion.sock");
}
function companionRunDir() {
  return path2.join(os.homedir(), ".config", "memlin", "run");
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

// packages/plugin-core/src/client.ts
import { promises as fs4 } from "node:fs";
import path6 from "node:path";
import os5 from "node:os";
import { randomUUID as randomUUID3 } from "node:crypto";

// packages/plugin-core/src/auth.ts
import { promises as fs2 } from "node:fs";
import path3 from "node:path";
import os2 from "node:os";
import { randomUUID } from "node:crypto";

// packages/plugin-core/src/atomic-rename.ts
import { promises as fs } from "node:fs";
import path from "node:path";
var RETRYABLE_CODES = /* @__PURE__ */ new Set(["EPERM", "EACCES", "EBUSY"]);
var MAX_ATTEMPTS = 10;
var BASE_DELAY_MS = 10;
var MAX_DELAY_MS = 100;
var renameQueues = /* @__PURE__ */ new Map();
async function renameWithRetry(from, to, rename) {
  for (let attempt = 1; ; attempt++) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      const code = error.code;
      if (attempt >= MAX_ATTEMPTS || !code || !RETRYABLE_CODES.has(code)) throw error;
      const cap = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
      const delay2 = cap / 2 + Math.random() * (cap / 2);
      await new Promise((resolve) => setTimeout(resolve, delay2));
    }
  }
}
async function atomicRename(from, to, dependencies = {}) {
  const rename = dependencies.rename ?? fs.rename;
  const queueKey = path.resolve(to);
  const previous = renameQueues.get(queueKey) ?? Promise.resolve();
  const run = previous.catch(() => void 0).then(() => renameWithRetry(from, to, rename));
  renameQueues.set(queueKey, run);
  try {
    await run;
  } finally {
    if (renameQueues.get(queueKey) === run) renameQueues.delete(queueKey);
  }
}

// packages/plugin-core/src/auth.ts
var MEMLIN_PROD_AUTH0_DOMAIN = "memlin.us.auth0.com";
var MEMLIN_PROD_AUTH0_CLIENT_ID = "fyYMQ4Cxc6Nu5juVwL8Ihqq4fgAFecG9";
var AUTH0_DOMAIN = process.env.MEMLIN_AUTH0_DOMAIN || MEMLIN_PROD_AUTH0_DOMAIN;
var AUTH0_CLIENT_ID = process.env.MEMLIN_AUTH0_CLIENT_ID || MEMLIN_PROD_AUTH0_CLIENT_ID;
var AUTH0_AUDIENCE = process.env.MEMLIN_AUTH0_AUDIENCE ?? "https://api.memlin.ai";
function persistedTokenFilePath() {
  return process.env.MEMLIN_TOKEN_FILE || path3.join(os2.homedir(), ".config", "memlin", "token.json");
}
var AUTH_FILE_LOCK_TIMEOUT_MS = 15e3;
var AUTH_FILE_LOCK_STALE_MS = 2 * 6e4;
var AUTH_FILE_LOCK_RETRY_MS = 50;
function authFileLockPath() {
  return `${persistedTokenFilePath()}.auth.lock`;
}
async function acquireAuthFileLock() {
  const file = authFileLockPath();
  const owner = `${process.pid}:${randomUUID()}`;
  await fs2.mkdir(path3.dirname(file), { recursive: true });
  const deadline = Date.now() + AUTH_FILE_LOCK_TIMEOUT_MS;
  while (true) {
    try {
      const handle = await fs2.open(file, "wx", 384);
      try {
        await handle.writeFile(owner, "utf8");
        await handle.sync();
      } catch (error) {
        await handle.close().catch(() => {
        });
        await fs2.rm(file, { force: true }).catch(() => {
        });
        throw error;
      }
      let released = false;
      return async () => {
        if (released) return;
        released = true;
        await handle.close().catch(() => {
        });
        const currentOwner = await fs2.readFile(file, "utf8").catch(() => null);
        if (currentOwner === owner) await fs2.rm(file, { force: true }).catch(() => {
        });
      };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      try {
        const stat = await fs2.stat(file);
        if (Date.now() - stat.mtimeMs > AUTH_FILE_LOCK_STALE_MS) {
          await fs2.rm(file, { force: true });
          continue;
        }
      } catch (statError) {
        if (statError.code === "ENOENT") continue;
        throw statError;
      }
      if (Date.now() >= deadline) {
        throw new Error("another Memlin sign-in or token refresh is still being saved");
      }
      await new Promise((resolve) => setTimeout(resolve, AUTH_FILE_LOCK_RETRY_MS));
    }
  }
}
async function withAuthFileLock(operation) {
  const release = await acquireAuthFileLock();
  try {
    return await operation();
  } finally {
    await release();
  }
}
async function readPersistedToken() {
  try {
    const raw = await fs2.readFile(persistedTokenFilePath(), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
async function writePersistedToken(t) {
  const file = persistedTokenFilePath();
  await fs2.mkdir(path3.dirname(file), { recursive: true });
  const tmp = path3.join(
    path3.dirname(file),
    `${path3.basename(file)}.tmp-${process.pid}-${randomUUID()}`
  );
  await fs2.writeFile(tmp, JSON.stringify(t, null, 2), { mode: 384 });
  await fs2.chmod(tmp, 384).catch(() => {
  });
  await atomicRename(tmp, file);
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
  const refreshSource = latest ?? stale;
  const refreshToken = refreshSource.refresh_token;
  if (!refreshToken) {
    throw new Error("access token expired and no refresh token saved \u2014 run `memlin login`");
  }
  try {
    const fresh = await refreshAccessToken(refreshToken);
    return await withAuthFileLock(async () => {
      const beforeWrite = await readPersistedToken();
      if (!beforeWrite || beforeWrite.access_token !== refreshSource.access_token) {
        if (beforeWrite && Date.now() < beforeWrite.expires_at - marginMs) {
          return beforeWrite.access_token;
        }
        throw new Error("saved Memlin credentials changed while the token was refreshing");
      }
      await writePersistedToken(fresh);
      return fresh.access_token;
    });
  } catch (err) {
    const after = await readPersistedToken();
    if (after && after.access_token !== refreshSource.access_token && Date.now() < after.expires_at - 6e4) {
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
function decodeJwtPayload(jwt) {
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("not a JWT");
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
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
var AGENT_PLATFORM_HEADER = "Memlin-Agent-Platform";
var AGENT_ARCHITECTURE_HEADER = "Memlin-Agent-Architecture";
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
async function closeHttpSockets() {
  try {
    const dispatcher = globalThis[/* @__PURE__ */ Symbol.for("undici.globalDispatcher.1")];
    if (dispatcher && typeof dispatcher.close === "function") {
      let timer;
      await Promise.race([
        dispatcher.close(),
        new Promise((resolve) => {
          timer = setTimeout(resolve, 250);
          timer.unref?.();
        })
      ]).finally(() => {
        if (timer !== void 0) clearTimeout(timer);
      });
    }
  } catch {
  }
}

// packages/plugin-core/src/host.ts
import os3 from "node:os";
import path4 from "node:path";
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
    return path4.join(this.home, "plans");
  }
};
var ClaudeCodeHost = class extends BaseHost {
  constructor() {
    super("claude-code", path4.join(os3.homedir(), ".claude"));
  }
};
var CursorHost = class extends BaseHost {
  constructor() {
    super("cursor", path4.join(os3.homedir(), ".config", "memlin"));
  }
};
var CodexHost = class extends BaseHost {
  constructor() {
    super("codex", path4.join(os3.homedir(), ".config", "memlin"));
  }
};
var WindsurfHost = class extends BaseHost {
  constructor() {
    super("windsurf", path4.join(os3.homedir(), ".config", "memlin"));
  }
};
var AntigravityHost = class extends BaseHost {
  constructor() {
    super("antigravity", path4.join(os3.homedir(), ".config", "memlin"));
  }
};
var VSCodeHost = class extends BaseHost {
  constructor() {
    super("vscode", path4.join(os3.homedir(), ".config", "memlin"));
  }
};
var CompanionHost = class extends BaseHost {
  constructor() {
    super("companion", path4.join(os3.homedir(), ".config", "memlin"));
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
  cachedAgentVersion = "0.1.34";
  return cachedAgentVersion;
}
function agentCapabilities() {
  return AGENT_EXPECTED_CAPABILITIES[resolveHost().kind] ?? ["api", "resolve"];
}
var DEFAULT_REQUEST_TIMEOUT_MS = 15e3;
var DEFAULT_MAX_RETRIES = 2;
var DEFAULT_RETRY_BASE_DELAY_MS = 250;
var RETRIABLE_STATUS = /* @__PURE__ */ new Set([408, 429, 500, 502, 503, 504]);
var RETRIABLE_NETWORK_CODES = /* @__PURE__ */ new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ECONNABORTED",
  "ETIMEDOUT",
  "EPIPE",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_SOCKET"
]);
function isRetriableNetworkError(error) {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return true;
  }
  let current = error;
  for (let depth = 0; current instanceof Error && depth < 5; depth++) {
    const code = current.code;
    if (code && RETRIABLE_NETWORK_CODES.has(code)) return true;
    current = current.cause;
  }
  return false;
}
function unreachableError(url, cause) {
  let host = url;
  try {
    host = new URL(url).host;
  } catch {
  }
  return new Error(
    `Couldn't reach Memlin at ${host}. Check your internet connection and try again.`,
    { cause }
  );
}
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      [AGENT_CAPABILITIES_HEADER]: agentCapabilities().join(","),
      [AGENT_PLATFORM_HEADER]: process.env.MEMLIN_AGENT_PLATFORM || os4.platform(),
      [AGENT_ARCHITECTURE_HEADER]: process.env.MEMLIN_AGENT_ARCH || os4.arch()
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
    const idempotent = method === "GET";
    const maxAttempts = idempotent ? (this.cfg.maxRetries ?? DEFAULT_MAX_RETRIES) + 1 : 1;
    const timeoutMs = this.cfg.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    for (let attempt = 1; ; attempt++) {
      let res;
      let text;
      try {
        res = await fetch(url, {
          method,
          headers,
          // A dead socket must abort rather than hang the caller forever.
          signal: AbortSignal.timeout(timeoutMs),
          ...body !== void 0 ? { body: JSON.stringify(body) } : {}
        });
        text = await res.text();
      } catch (error) {
        if (attempt < maxAttempts && isRetriableNetworkError(error)) {
          await delay(this.backoffMs(attempt));
          continue;
        }
        throw unreachableError(url, error);
      }
      if (idempotent && attempt < maxAttempts && RETRIABLE_STATUS.has(res.status)) {
        await delay(this.backoffMs(attempt));
        continue;
      }
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
  }
  backoffMs(attempt) {
    const base = this.cfg.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
    return base * 2 ** (attempt - 1);
  }
  // ---------- endpoints ----------
  /** GET /me — identity + account list. No account header sent (this is the discovery call). */
  async me() {
    return this.request("GET", "/me", void 0, { includeAccount: false });
  }
  /**
   * GET /report — account-scoped usage aggregates (tokens saved, resolves,
   * hit rate). The route nests the window (`window: { from, days }` — no
   * top-level days field) and clamps days to [1, 31] server-side (default 1);
   * `projectId` maps to the `?project=` query param. Consumed by the
   * Companion's Memory panel for its tokens-saved counter.
   */
  async report(opts = {}) {
    const q = new URLSearchParams();
    if (opts.days !== void 0) q.set("days", String(opts.days));
    if (opts.projectId) q.set("project", opts.projectId);
    const qs = q.toString();
    return this.request("GET", `/report${qs ? `?${qs}` : ""}`);
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
  async listDocuments(opts = {}, callOpts = {}) {
    const qs = new URLSearchParams();
    if (opts.kinds) for (const k of opts.kinds) qs.append("kind", k);
    if (opts.scopes) for (const s of opts.scopes) qs.append("scope", s);
    if (opts.statuses) for (const s of opts.statuses) qs.append("status", s);
    if (opts.project_id !== void 0) {
      qs.set("project_id", opts.project_id === null ? "null" : opts.project_id);
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const res = await this.request("GET", `/documents${suffix}`, void 0, { accountId: callOpts.accountId });
    return res.documents.map((d) => {
      const { status, ...rest } = d;
      return status == null ? rest : { ...rest, status };
    });
  }
  /** POST /documents — create or update a document. */
  async writeDocument(input, callOpts = {}) {
    return this.request("POST", "/documents", input, {
      accountId: callOpts.accountId
    });
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
  /** Atomically create/select a project and register one or more logical
   * local sources. Device paths are intentionally absent from this wire
   * contract. */
  async linkLocalSources(input, opts = {}) {
    return this.request("POST", "/projects/local-link", input, { accountId: opts.accountId });
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
import { randomUUID as randomUUID2 } from "node:crypto";
import { constants, promises as fs3 } from "node:fs";
import path5 from "node:path";
var WORKSPACE_DIR_NAME = ".memlin";
var WORKSPACE_BINDING_FILE = "config.json";
var GIT_POINTER_MAX_BYTES = 8 * 1024;
async function walkForWorkspaceBinding(startDir) {
  let dir = path5.resolve(startDir);
  for (let i = 0; i < 64; i++) {
    const candidate = path5.join(dir, WORKSPACE_DIR_NAME, WORKSPACE_BINDING_FILE);
    try {
      const raw = await fs3.readFile(candidate, "utf8");
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
    const parent = path5.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}
async function readSmallRegularFile(file) {
  let before;
  try {
    before = await fs3.lstat(file);
  } catch (error) {
    return isFileNotFound(error) ? { kind: "missing" } : { kind: "invalid" };
  }
  try {
    if (before.isSymbolicLink() || !before.isFile() || before.size > GIT_POINTER_MAX_BYTES) {
      return { kind: "invalid" };
    }
    const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
    const handle = await fs3.open(file, constants.O_RDONLY | noFollow);
    try {
      const opened = await handle.stat();
      if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== before.size || opened.size > GIT_POINTER_MAX_BYTES) {
        return { kind: "invalid" };
      }
      const bytes = await handle.readFile();
      const [after, afterPath] = await Promise.all([handle.stat(), fs3.lstat(file)]);
      if (afterPath.isSymbolicLink() || !afterPath.isFile() || after.dev !== opened.dev || after.ino !== opened.ino || after.size !== opened.size || afterPath.dev !== opened.dev || afterPath.ino !== opened.ino || afterPath.size !== opened.size || bytes.byteLength !== opened.size || bytes.includes(0)) {
        return { kind: "invalid" };
      }
      return { kind: "ok", value: bytes.toString("utf8") };
    } finally {
      await handle.close();
    }
  } catch {
    return { kind: "invalid" };
  }
}
function containedBy(parent, child) {
  const relative = path5.relative(parent, child);
  return relative === "" || relative !== ".." && !relative.startsWith(`..${path5.sep}`) && !path5.isAbsolute(relative);
}
async function canonicalSafeDirectory(candidate) {
  try {
    const before = await fs3.lstat(candidate);
    if (before.isSymbolicLink() || !before.isDirectory()) return null;
    await fs3.access(candidate, constants.R_OK | constants.X_OK);
    const canonical = await fs3.realpath(candidate);
    const after = await fs3.lstat(candidate);
    if (after.isSymbolicLink() || !after.isDirectory() || after.dev !== before.dev || after.ino !== before.ino) {
      return null;
    }
    return canonical;
  } catch {
    return null;
  }
}
function gitIdentity(checkoutRoot, state, repositoryRoot = checkoutRoot) {
  return {
    checkout_root: checkoutRoot,
    repository_root: repositoryRoot,
    state
  };
}
async function resolveGitWorkspaceIdentity(startDir) {
  const requested = path5.resolve(startDir);
  let canonicalStart;
  try {
    canonicalStart = await fs3.realpath(requested);
    const startEntry = await fs3.stat(canonicalStart);
    if (!startEntry.isDirectory()) return gitIdentity(canonicalStart, "unknown");
  } catch {
    return gitIdentity(requested, "unknown");
  }
  let dir = canonicalStart;
  for (let i = 0; i < 64; i++) {
    const gitEntry = path5.join(dir, ".git");
    let entry;
    try {
      entry = await fs3.lstat(gitEntry);
    } catch (error) {
      if (!isFileNotFound(error)) return gitIdentity(dir, "unknown");
      const parent = path5.dirname(dir);
      if (parent === dir) return gitIdentity(canonicalStart, "none");
      dir = parent;
      continue;
    }
    const checkoutRoot = dir;
    if (entry.isSymbolicLink()) return gitIdentity(checkoutRoot, "unknown");
    if (entry.isDirectory()) {
      if (!await canonicalSafeDirectory(gitEntry)) return gitIdentity(checkoutRoot, "unknown");
      return gitIdentity(checkoutRoot, "main");
    }
    if (!entry.isFile()) return gitIdentity(checkoutRoot, "unknown");
    const pointerRead = await readSmallRegularFile(gitEntry);
    if (pointerRead.kind !== "ok" || pointerRead.value.includes("\0")) {
      return gitIdentity(checkoutRoot, "unknown");
    }
    const pointerMatch = /^gitdir:[ \t]*([^\r\n]+)\r?\n?$/.exec(pointerRead.value);
    const pointerValue = pointerMatch?.[1];
    if (!pointerValue) return gitIdentity(checkoutRoot, "unknown");
    let gitDirCandidate;
    try {
      gitDirCandidate = path5.isAbsolute(pointerValue) ? pointerValue : path5.resolve(checkoutRoot, pointerValue);
    } catch {
      return gitIdentity(checkoutRoot, "unknown");
    }
    const gitDir = await canonicalSafeDirectory(gitDirCandidate);
    if (!gitDir) return gitIdentity(checkoutRoot, "unknown");
    const commonRead = await readSmallRegularFile(path5.join(gitDir, "commondir"));
    if (commonRead.kind === "missing") {
      const gitDirParent = path5.dirname(gitDir);
      const looksLikeWorktreeAdmin = path5.basename(gitDirParent) === "worktrees" && path5.basename(path5.dirname(gitDirParent)) === ".git";
      if (looksLikeWorktreeAdmin) return gitIdentity(checkoutRoot, "unknown");
      return gitIdentity(checkoutRoot, "main");
    }
    if (commonRead.kind !== "ok" || commonRead.value.includes("\0")) {
      return gitIdentity(checkoutRoot, "unknown");
    }
    const commonMatch = /^([^\r\n]+)\r?\n?$/.exec(commonRead.value);
    const commonValue = commonMatch?.[1];
    if (!commonValue) return gitIdentity(checkoutRoot, "unknown");
    let commonCandidate;
    try {
      commonCandidate = path5.isAbsolute(commonValue) ? commonValue : path5.resolve(gitDir, commonValue);
    } catch {
      return gitIdentity(checkoutRoot, "unknown");
    }
    const commonDir = await canonicalSafeDirectory(commonCandidate);
    if (!commonDir) return gitIdentity(checkoutRoot, "unknown");
    const worktreesDir = path5.join(commonDir, "worktrees");
    if (path5.basename(commonDir) !== ".git" || gitDir === worktreesDir || !containedBy(worktreesDir, gitDir)) {
      return gitIdentity(checkoutRoot, "unknown");
    }
    const repositoryRoot = path5.dirname(commonDir);
    const repositoryGitDir = await canonicalSafeDirectory(path5.join(repositoryRoot, ".git"));
    if (!repositoryGitDir || repositoryGitDir !== commonDir) {
      return gitIdentity(checkoutRoot, "unknown");
    }
    const reverseRead = await readSmallRegularFile(path5.join(gitDir, "gitdir"));
    if (reverseRead.kind !== "ok" || reverseRead.value.includes("\0")) {
      return gitIdentity(checkoutRoot, "unknown");
    }
    const reverseMatch = /^([^\r\n]+)\r?\n?$/.exec(reverseRead.value);
    const reverseValue = reverseMatch?.[1];
    if (!reverseValue) return gitIdentity(checkoutRoot, "unknown");
    try {
      const reverseCandidate = path5.isAbsolute(reverseValue) ? reverseValue : path5.resolve(gitDir, reverseValue);
      const [reverseTarget, checkoutGitFile] = await Promise.all([
        fs3.realpath(reverseCandidate),
        fs3.realpath(gitEntry)
      ]);
      if (reverseTarget !== checkoutGitFile) return gitIdentity(checkoutRoot, "unknown");
    } catch {
      return gitIdentity(checkoutRoot, "unknown");
    }
    return gitIdentity(checkoutRoot, "worktree", repositoryRoot);
  }
  return gitIdentity(canonicalStart, "unknown");
}
async function findWorkspaceBinding(startDir) {
  const direct = await walkForWorkspaceBinding(startDir);
  const gitIdentity2 = await resolveGitWorkspaceIdentity(startDir);
  if (gitIdentity2.state !== "worktree") return direct;
  if (direct) {
    const bindingRoot = await fs3.realpath(direct.workspaceRoot).catch(() => path5.resolve(direct.workspaceRoot));
    if (containedBy(gitIdentity2.checkout_root, bindingRoot)) return direct;
  }
  return walkForWorkspaceBinding(gitIdentity2.repository_root);
}
function isFileNotFound(error) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

// packages/plugin-core/src/client.ts
function globalConfigFilePath() {
  return process.env.MEMLIN_CONFIG_FILE || path6.join(os5.homedir(), ".config", "memlin", "config.json");
}
var CONFIG_DIR = path6.join(os5.homedir(), ".config", "memlin");
var TOKEN_FILE = path6.join(CONFIG_DIR, "token.json");
async function readConfig() {
  try {
    const raw = await fs4.readFile(globalConfigFilePath(), "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.account_id !== "string" || !parsed.account_id.trim() || typeof parsed.user_id !== "string" || !parsed.user_id.trim() || typeof parsed.auth0_sub !== "string" || !parsed.auth0_sub.trim()) {
      return null;
    }
    return {
      api_url: typeof parsed.api_url === "string" && parsed.api_url.trim() ? parsed.api_url : DEFAULT_API_URL,
      account_id: parsed.account_id,
      user_id: parsed.user_id,
      auth0_sub: parsed.auth0_sub,
      project_id: typeof parsed.project_id === "string" || parsed.project_id === null ? parsed.project_id : null
    };
  } catch {
    return null;
  }
}
function accessTokenSubject(accessToken) {
  try {
    const subject = decodeJwtPayload(accessToken).sub;
    return typeof subject === "string" && subject.length > 0 ? subject : null;
  } catch {
    return null;
  }
}
function configMatchesAccessToken(config, accessToken) {
  const subject = accessTokenSubject(accessToken);
  return subject !== null && subject === config.auth0_sub;
}
async function getIdentityBoundAccessToken(config) {
  const accessToken = await getValidAccessToken();
  if (!configMatchesAccessToken(config, accessToken)) {
    throw new Error("not signed in \u2014 saved Memlin account does not match the saved token");
  }
  return accessToken;
}
async function getApi(opts = {}) {
  const config = await readConfig();
  if (!config) return null;
  try {
    await getIdentityBoundAccessToken(config);
  } catch {
    return null;
  }
  const cwd = opts.cwd ?? process.cwd();
  const overlay = await findWorkspaceBinding(cwd);
  const { workspaceBound, workspaceRoot } = applyWorkspaceOverlay(config, overlay);
  const apiUrl = process.env.MEMLIN_API_URL?.trim() || config.api_url || resolveApiUrl();
  const api = new MemlinApiClient({
    baseUrl: apiUrl,
    getAccessToken: () => getIdentityBoundAccessToken(config),
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

// packages/plugin-core/src/cli/cli-runner.ts
var WATCHDOG_MS = 2e3;
var CliExit = class extends Error {
  constructor(code) {
    super(`CliExit(${code})`);
    this.code = code;
    this.name = "CliExit";
  }
  code;
};
function exitCli(code) {
  throw new CliExit(code);
}
function scheduleProcessExit(code) {
  process.exitCode = code;
  void closeHttpSockets();
  setTimeout(() => process.exit(), WATCHDOG_MS).unref();
}
function runCliMain(main2, onError) {
  main2().then(
    (code) => scheduleProcessExit(typeof code === "number" ? code : 0),
    (err) => {
      if (err instanceof CliExit) {
        scheduleProcessExit(err.code);
        return;
      }
      let code;
      try {
        code = onError(err);
      } catch (handlerErr) {
        if (handlerErr instanceof CliExit) {
          scheduleProcessExit(handlerErr.code);
          return;
        }
        console.error("cli error handler failed:", handlerErr);
        code = 1;
      }
      scheduleProcessExit(code);
    }
  );
}

// packages/plugin-core/src/cli/role.ts
function parseRoles(raw) {
  if (raw === void 0) return [];
  return raw.split(",").map((r) => r.trim().toLowerCase()).filter((r) => r.length > 0);
}
function printHelp() {
  console.log(
    [
      "memlin role \u2014 assign functional roles, or tag documents with roles",
      "",
      "Usage:",
      "  memlin role assign <roles>                 assign roles to yourself",
      "  memlin role assign <roles> --user <uuid>   assign to another member",
      "  memlin role tag <document-id> <roles>      tag a document",
      "",
      '<roles> is comma-separated, e.g.  backend,sre  \u2014 pass "" to clear.'
    ].join("\n")
  );
}
async function main() {
  const argv = process.argv.slice(2);
  const sub = argv[0];
  if (sub === "--help" || sub === "-h" || sub === "help") {
    printHelp();
    exitCli(0);
  }
  if (sub !== "assign" && sub !== "tag") {
    console.error(
      sub ? `memlin role: unknown subcommand "${sub}"` : "memlin role: missing subcommand"
    );
    printHelp();
    exitCli(2);
  }
  const ctx = await getApi();
  if (!ctx) {
    console.error("memlin role: not configured. Run `memlin login` first.");
    exitCli(1);
  }
  const { api } = ctx;
  if (sub === "assign") {
    if (argv[1] === void 0) {
      console.error('memlin role assign: missing <roles> (comma-separated; "" to clear)');
      exitCli(2);
    }
    const roles2 = parseRoles(argv[1]);
    let userId;
    const userIdx = argv.indexOf("--user");
    if (userIdx !== -1) {
      userId = argv[userIdx + 1];
      if (!userId) {
        console.error("memlin role assign: --user requires a user id");
        exitCli(2);
      }
    }
    try {
      const res = await api.assignRoles({ user_id: userId, roles: roles2 });
      const who = userId ? `user ${userId}` : "you";
      console.log(
        `Functional roles for ${who}: ${res.roles.length ? res.roles.join(", ") : "(none)"}`
      );
    } catch (err) {
      console.error(`memlin role assign: ${err instanceof Error ? err.message : err}`);
      exitCli(1);
    }
    return;
  }
  const documentId = argv[1];
  if (!documentId) {
    console.error("memlin role tag: missing <document-id>");
    exitCli(2);
  }
  if (argv[2] === void 0) {
    console.error('memlin role tag: missing <roles> (comma-separated; "" to clear)');
    exitCli(2);
  }
  const roles = parseRoles(argv[2]);
  try {
    const res = await api.tagDocumentRoles({ document_id: documentId, roles });
    console.log(
      `Document ${res.document_id} role tags: ${res.roles.length ? res.roles.join(", ") : "(none)"}`
    );
  } catch (err) {
    console.error(`memlin role tag: ${err instanceof Error ? err.message : err}`);
    exitCli(1);
  }
}
runCliMain(main, (err) => {
  console.error("memlin role failed:", err instanceof Error ? err.message : err);
  return 1;
});
