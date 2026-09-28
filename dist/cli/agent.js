#!/usr/bin/env node
import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);
import { fileURLToPath as __ftp } from 'node:url'; import { dirname as __dn } from 'node:path';
const __filename = __ftp(import.meta.url); const __dirname = __dn(__filename);

// packages/plugin-core/src/cli/agent.ts
import { randomUUID } from "node:crypto";

// packages/plugin-core/src/companion-client.ts
import http from "node:http";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
var COMPANION_PROTOCOL = 1;
var NO_COMPANION_ENV = "MEMLIN_NO_DAEMON";
var IS_COMPANION_ENV = "MEMLIN_DAEMON";
var COMPANION_SOCKET_ENV = "MEMLIN_COMPANION_SOCKET";
function companionSocketPath(env = process.env) {
  const override = env[COMPANION_SOCKET_ENV];
  if (override) return override;
  if (process.platform === "win32") {
    return `\\\\.\\pipe\\memlin-companion-${os.userInfo().username}`;
  }
  return path.join(os.homedir(), ".config", "memlin", "run", "companion.sock");
}
var CONNECT_TIMEOUT_MS = 150;
var DEFAULT_CALL_TIMEOUT_MS = 1e3;
var CALL_TIMEOUTS = {
  "workspace.resolve": 2e3,
  "nativeDevices.status": 3e4,
  "nativeDevices.list": 3e4,
  "nativeDevices.pairStart": 3e4,
  "nativeDevices.pairConfirm": 3e4,
  "nativeDevices.trust": 3e4,
  "nativeDevices.revoke": 3e4,
  "nativeDevices.renew": 6e4,
  "nativeDevices.keyOffer": 6e4,
  "nativeDevices.keyOffers": 6e4,
  "nativeDevices.keyAccept": 6e4,
  "resolve.start": 750,
  "resolve.reuse": 4500,
  "resolve.reserve": 750,
  "resolve.reserve-late": 750,
  "resolve.commit": 750,
  "resolve.release": 500,
  "resolve.report": 500,
  "sync.now": 5e3,
  "login.start": 1e4,
  // Local-store reads walk the materialized doc tree on disk.
  "memory.search": 2e3,
  "memory.read": 2e3
};
var socketDeadUntil = 0;
var SOCKET_DEAD_TTL_MS = 5e3;
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
      if (!socket.connecting) clearTimeout(connectTimer);
      else socket.once("connect", () => clearTimeout(connectTimer));
    });
    req.once("close", () => clearTimeout(connectTimer));
    req.on("timeout", () => {
      req.destroy();
      fail(false);
    });
    req.on("error", () => fail(true));
    req.end(payload);
  });
}

// packages/plugin-core/src/runtime-shared.ts
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

// packages/plugin-core/src/cli/agent.ts
async function readHiddenKey() {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new Error("Key setup requires an interactive terminal");
  process.stdout.write("API key (hidden): ");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  try {
    return await new Promise((resolve, reject) => {
      let key = "";
      const cleanup = () => {
        process.stdin.off("data", receive);
      };
      const receive = (data) => {
        for (const char of data.toString("utf8")) {
          if (char === "\r" || char === "\n") {
            cleanup();
            resolve(key);
            return;
          }
          if (char === "" || char === "") {
            cleanup();
            reject(new Error("Key setup cancelled"));
            return;
          }
          if (char === "\x7F" || char === "\b") key = key.slice(0, -1);
          else if (char >= " " && key.length < 8192) key += char;
        }
      };
      process.stdin.on("data", receive);
    });
  } finally {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdout.write("\n");
  }
}
async function main() {
  const args = process.argv.slice(2), cwd = process.cwd();
  const flag = (key) => {
    const at = args.indexOf(key);
    if (at < 0) return false;
    args.splice(at, 1);
    return true;
  };
  const value = (key) => {
    const at = args.indexOf(key);
    if (at < 0) return void 0;
    const result = args[at + 1];
    if (!result || result.startsWith("--")) throw new Error(`${key} requires a value`);
    args.splice(at, 2);
    return result;
  };
  const finite = (key, required = true, fallback = 0) => {
    const text = value(key);
    if (text === void 0) {
      if (required) throw new Error(`${key} is required`);
      return fallback;
    }
    const n = Number(text);
    if (!Number.isFinite(n) || n < 0) throw new Error(`${key} must be a finite nonnegative number`);
    return n;
  };
  if (flag("--help") || !args.length) {
    console.log(`memlin agent endpoints
memlin agent sync
memlin agent discover
memlin agent publish --endpoint <id>
memlin agent endpoint --url <base-url> --protocol <anthropic-messages|openai-responses|google-gemini|openai-chat> --name <name> --approve [--endpoint <existing-id>] [--kind <server-kind>] [--auth-mode <none|bearer|api_key>] [--private-network] [--local-inference]
memlin agent key --endpoint <id>
memlin agent probe --endpoint <id>
memlin agent resume --run <run-id>
memlin agent "task" --endpoint <id> --model <model> --max-tokens <n> --max-cost <usd> --input-price <usd/million> --output-price <usd/million> [--max-turns 8] [--local-only]
Add --compare-endpoint and --compare-model for read-only runs using one frozen context.
Model-server kinds include ollama, lmstudio, llamacpp, vllm, openllm, mlx, exo, openai-compatible and provider.
API-key mode is available for Anthropic and Gemini. Use bearer for OpenAI-compatible APIs, or --no-auth for a server without authentication.
Run probe before publish to include discovered models. Sync proposes endpoints; each device must approve its own destinations.
Explicit memory writes require --allow-memory-writes; their content is sent to Memlin.`);
    return;
  }
  const registry = await companionRequest("agent.endpoints", { cwd }, { timeoutMs: 15e3 });
  if (!registry)
    throw new Error("Open an updated Memlin Companion, sign in, and bind this workspace");
  if (args[0] === "resume") {
    args.shift();
    const runId = value("--run");
    if (!runId || args.length) throw new Error("Resume requires --run <run-id>");
    const result = await companionRequest("agent.resume", { runId, cwd }, { timeoutMs: 2e4 });
    if (!result)
      throw new Error("This run could not resume; uncertain operations require reconciliation");
    return watchRun(result.runId, cwd);
  }
  const endpointId = value("--endpoint");
  if (args[0] === "sync" || args[0] === "discover") {
    const result = await companionRequest(
      args[0] === "sync" ? "agent.endpoints.sync" : "agent.endpoints.discover",
      { cwd },
      { timeoutMs: 2e4 }
    );
    if (!result) throw new Error("Endpoint sync or discovery is unavailable");
    console.log(JSON.stringify(result.endpoints, null, 2));
    return;
  }
  if (args[0] === "endpoints") {
    console.log(JSON.stringify(registry.endpoints, null, 2));
    return;
  }
  if (args[0] === "endpoint") {
    args.shift();
    const baseUrl = value("--url"), protocol = value("--protocol"), name = value("--name");
    if (!baseUrl || !protocol || !name || !flag("--approve"))
      throw new Error("Endpoint setup requires --url, --protocol, --name and explicit --approve");
    const authMode = value("--auth-mode"), noAuth = flag("--no-auth");
    if (authMode && noAuth) throw new Error("Choose --auth-mode or --no-auth");
    const auth = authMode ?? (noAuth ? "none" : ["anthropic-messages", "google-gemini"].includes(protocol) ? "api_key" : "bearer");
    if (!["none", "bearer", "api_key"].includes(auth) || auth === "api_key" && !["anthropic-messages", "google-gemini"].includes(protocol))
      throw new Error("Unsupported authentication for this API format");
    const endpoint2 = {
      id: endpointId ?? randomUUID(),
      baseUrl,
      protocol,
      name,
      kind: value("--kind") ?? "openai-compatible",
      auth,
      privateNetwork: flag("--private-network"),
      localInference: flag("--local-inference"),
      models: []
    };
    if (args.length) throw new Error("Unknown endpoint option");
    if (!await companionRequest("agent.endpoint.approve", { cwd, endpoint: endpoint2 }, { timeoutMs: 15e3 }))
      throw new Error("Destination approval failed");
    console.log(`Approved endpoint ${endpoint2.name}: ${endpoint2.id}`);
    return;
  }
  const endpoint = registry.endpoints.find((x) => x.id === endpointId || x.name === endpointId);
  if (!endpoint) throw new Error("Select an approved endpoint with --endpoint");
  if (args[0] === "publish") {
    const result = await companionRequest(
      "agent.endpoint.publish",
      { cwd, endpointId: endpoint.id },
      { timeoutMs: 15e3 }
    );
    if (!result) throw new Error("Endpoint settings could not sync");
    console.log("Endpoint settings synced. Each device must approve the destination before use.");
    return;
  }
  if (args[0] === "key") {
    const key = await readHiddenKey();
    const result = await companionRequest(
      "agent.key.set",
      { cwd, endpointId: endpoint.id, key },
      { timeoutMs: 15e3 }
    );
    if (!result) throw new Error("Companion could not save this key in the protected device vault");
    console.log("Provider key configured in the device vault.");
    return;
  }
  if (args[0] === "probe") {
    const result = await companionRequest(
      "agent.endpoint.probe",
      { cwd, endpointId: endpoint.id },
      { timeoutMs: 2e4 }
    );
    if (!result) throw new Error("Endpoint probe unavailable");
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  const requestedProvider = value("--provider");
  const modelName = value("--model");
  if (!modelName) throw new Error("--model is required");
  const budget = {
    maxTokens: finite("--max-tokens"),
    maxCostUsd: finite("--max-cost"),
    maxTurns: finite("--max-turns", false, 8)
  };
  const inputUsdPerMillion = finite("--input-price"), outputUsdPerMillion = finite("--output-price");
  const maxOutputTokens = finite("--max-output-tokens", false, 2048);
  const localOnly = flag("--local-only"), allowMemoryWrites = flag("--allow-memory-writes");
  const providerFor = (e) => e.kind === "provider" ? e.protocol === "anthropic-messages" ? "anthropic" : e.protocol === "google-gemini" ? "google" : new URL(e.baseUrl).hostname === "api.x.ai" ? "xai" : "openai" : "endpoint";
  if (requestedProvider && requestedProvider !== "both" && requestedProvider !== providerFor(endpoint))
    throw new Error("--provider must match the selected endpoint, or use both for comparison");
  const selection = (e, model) => ({
    endpointId: e.id,
    model: {
      provider: providerFor(e),
      protocol: e.protocol,
      endpointId: e.id,
      model,
      maxOutputTokens,
      inputUsdPerMillion,
      outputUsdPerMillion
    }
  });
  const models = [selection(endpoint, modelName)];
  const compareId = value("--compare-endpoint");
  if (compareId || requestedProvider === "both") {
    const compare = compareId ? registry.endpoints.find((x) => x.id === compareId || x.name === compareId) : registry.endpoints.find((x) => x.protocol === "anthropic-messages");
    const compareModel = value("--compare-model") ?? value("--anthropic-model");
    if (!compare || !compareModel)
      throw new Error("Comparison requires an approved second endpoint and --compare-model");
    const other = selection(compare, compareModel);
    other.model.inputUsdPerMillion = finite("--compare-input-price");
    other.model.outputUsdPerMillion = finite("--compare-output-price");
    models.push(other);
  }
  if (args.some((x) => x.startsWith("--"))) throw new Error("Unknown agent option");
  const task = args.join(" ").trim();
  if (!task) throw new Error("Provide an agent task");
  const started = await companionRequest(
    "agent.start",
    { clientRequestId: randomUUID(), cwd, task, models, budget, localOnly, allowMemoryWrites },
    { timeoutMs: 2e4 }
  );
  if (!started)
    throw new Error("Native run could not start; check destination approval and budgets");
  return watchRun(started.runId, cwd);
}
async function watchRun(runId, cwd) {
  const cancel = () => {
    void companionRequest("agent.cancel", { runId });
  };
  process.once("SIGINT", cancel);
  try {
    let displayed = 0;
    for (; ; ) {
      const status = await companionRequest("agent.status", { runId, cwd }, { timeoutMs: 1e4 });
      if (!status)
        throw new Error(
          `Companion disconnected. Run ${runId} needs reconciliation; do not repeat effects blindly.`
        );
      if (status.text.length > displayed) {
        process.stdout.write(status.text.slice(displayed));
        displayed = status.text.length;
      }
      if (!["starting", "running"].includes(status.state)) {
        console.log(`
${status.state} \xB7 run ${runId}`);
        for (const result of status.results)
          console.log(
            JSON.stringify({
              run_id: result.runId,
              audit_id: result.context.auditId,
              context_source: result.context.source,
              status: result.status,
              input_tokens: result.inputTokens,
              output_tokens: result.outputTokens,
              estimated_cost_usd: result.costUsd,
              reason: result.reason
            })
          );
        if (status.error) console.error(status.error);
        return status.state === "completed" ? 0 : 1;
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  } finally {
    process.off("SIGINT", cancel);
  }
}
runCliMain(main, (error) => {
  console.error(
    `memlin agent: ${error instanceof Error ? error.message : "Unable to complete the request"}`
  );
  return 1;
});
