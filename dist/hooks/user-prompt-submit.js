#!/usr/bin/env node
import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);

// apps/windsurf-plugin/src/hooks/user-prompt-submit.ts
import { promises as fs3 } from "node:fs";
import os3 from "node:os";
import path3 from "node:path";
import { fileURLToPath } from "node:url";

// apps/windsurf-plugin/src/hook-io.ts
function readHookInput() {
  return new Promise((resolve) => {
    let data = "";
    const done = () => {
      try {
        resolve(data.trim() ? JSON.parse(data) : null);
      } catch {
        resolve(null);
      }
    };
    const timer = setTimeout(done, 1e3);
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      clearTimeout(timer);
      done();
    });
    process.stdin.on("error", () => {
      clearTimeout(timer);
      done();
    });
  });
}

// packages/plugin-core/dist/state.js
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
var STATE_FILE = path.join(os.homedir(), ".config", "memlin", "state.json");
var EMPTY = { documents: {} };
async function readState() {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return { ...EMPTY };
  }
}
async function writeState(state) {
  await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
  const tmp = `${STATE_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), "utf8");
  await fs.rename(tmp, STATE_FILE);
}
var LOCK_DIR = `${STATE_FILE}.lock`;

// packages/plugin-core/dist/continuity.js
var CONTINUITY_WINDOW_MS = 10 * 60 * 1e3;
var CONTINUATION_PATTERNS = [
  /^\s*(and|also|then|now|next|plus|but|or|so)\b/i,
  /^\s*(what about|how about|tell me more|go on|continue|keep going)\b/i,
  /^\s*(explain|show me|expand|elaborate)\s+(that|this|it|the|more)\b/i,
  /^\s*(yes|yeah|ok|sure|right),?\s+(now|and|so|continue|keep)\b/i,
  /^\s*(can you|could you)\s+(also|now|then|continue|elaborate)\b/i,
  /\b(the one|that|those|these)\b.*\?$/i
  // referential question
];
function isContinuation(prompt, cwd, host, last, sessionId) {
  if (last.host !== host) return false;
  if (sessionId && last.session_id && last.session_id !== sessionId) return false;
  if (last.delivered === false) return false;
  if (last.cwd !== cwd) return false;
  if (Date.now() - last.resolved_at > CONTINUITY_WINDOW_MS) return false;
  if (!last.had_content) return false;
  const trimmed = prompt.trim();
  if (trimmed.length <= 80) return true;
  for (const re of CONTINUATION_PATTERNS) {
    if (re.test(trimmed)) return true;
  }
  return false;
}
function buildContinuityMarker(auditId) {
  return [
    "<memlin-context-unchanged>",
    `# This turn is a follow-up to the prior turn. The same Memlin context applies.`,
    `# Refer to the bundle injected on the previous turn (audit_id: ${auditId}).`,
    "# If you need fresh context, ask the user to rephrase or invoke memlin_resolve_task directly.",
    "</memlin-context-unchanged>"
  ].join("\n");
}

// packages/plugin-core/dist/pending-bundle.js
import { spawn } from "node:child_process";
import { promises as fs2 } from "node:fs";
import path2 from "node:path";
import os2 from "node:os";
var PENDING_BUNDLE_MAX_AGE_MS = 10 * 60 * 1e3;
function pendingBundlePath() {
  return process.env.MEMLIN_RESOLVE_OUT ?? path2.join(os2.homedir(), ".config", "memlin", "pending-bundle.json");
}
async function takePendingBundle(cwd, host) {
  const file = pendingBundlePath();
  let bundle;
  try {
    bundle = JSON.parse(await fs2.readFile(file, "utf8"));
  } catch {
    return null;
  }
  if (typeof bundle !== "object" || bundle === null || typeof bundle.rendered !== "string" || bundle.rendered.length === 0) {
    await fs2.rm(file, { force: true }).catch(() => {
    });
    return null;
  }
  const expired = Date.now() - bundle.completed_at > PENDING_BUNDLE_MAX_AGE_MS;
  if (expired) {
    await fs2.rm(file, { force: true }).catch(() => {
    });
    return null;
  }
  if (bundle.cwd !== cwd || bundle.host !== host) {
    return null;
  }
  await fs2.rm(file, { force: true }).catch(() => {
  });
  return bundle;
}
var DEFAULT_RESOLVE_BUDGET_MS = 6e3;
function resolveBudgetMs() {
  const v = Number(process.env.MEMLIN_RESOLVE_BUDGET_MS);
  return Number.isFinite(v) && v >= 1e3 ? Math.floor(v) : DEFAULT_RESOLVE_BUDGET_MS;
}
function runResolveWithBudget(opts) {
  const budget = opts.budgetMs ?? resolveBudgetMs();
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(process.execPath, [opts.resolveBin, opts.task], {
        cwd: opts.cwd,
        env: {
          ...process.env,
          MEMLIN_HOST: opts.host,
          // Handoff contract with cli/resolve.ts: write the compiled bundle
          // to this file (atomic), and report a resolve.delivery telemetry
          // row when the deadline was missed.
          MEMLIN_RESOLVE_OUT: pendingBundlePath(),
          MEMLIN_RESOLVE_DEADLINE_MS: String(budget),
          // Forward the agent's session id so the resolve's usage_event is
          // attributable to this session (concurrent-work awareness).
          ...opts.sessionId ? { MEMLIN_SESSION_ID: opts.sessionId } : {}
        },
        // Detached + no shared stdio: when the caller stops waiting, the
        // child owns its own lifetime and finishes in the background.
        detached: true,
        stdio: "ignore"
      });
    } catch {
      resolve({ bundle: null, stillRunning: false });
      return;
    }
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.unref();
      resolve({ bundle: null, stillRunning: true });
    }, budget);
    child.on("exit", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void takePendingBundle(opts.cwd, opts.host).then(
        (bundle) => resolve({ bundle, stillRunning: false })
      );
    });
    child.on("error", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ bundle: null, stillRunning: false });
    });
  });
}
function buildLateDeliveryEnvelope(bundle) {
  return [
    "<memlin-late-context>",
    "# Memlin context resolved for the PREVIOUS prompt \u2014 it finished after that",
    `# turn's delivery deadline. Task it was resolved for: ${JSON.stringify(bundle.task.slice(0, 140))}`,
    "# Treat as background context; invoke memlin_resolve_task if this turn needs fresh context.",
    "",
    bundle.rendered,
    "</memlin-late-context>"
  ].join("\n");
}

// packages/plugin-core/dist/scribe-notice.js
async function takeScribeNotice(currentSessionId) {
  let state;
  try {
    state = await readState();
  } catch {
    return "";
  }
  const notice = state.scribe_notice;
  const n = notice?.unsurfaced ?? 0;
  if (n <= 0) return "";
  try {
    delete state.scribe_notice;
    await writeState(state);
  } catch {
  }
  if (currentSessionId && notice?.session_id && notice.session_id !== currentSessionId) {
    return "";
  }
  return [
    "<memlin-notice>",
    "# Status line for the user \u2014 surface it, do not act on it.",
    `Memlin auto-captured ${n} new proposal${n === 1 ? "" : "s"} \u2014 review and accept/reject with /memlin-inbox.`,
    "</memlin-notice>",
    ""
  ].join("\n");
}

// apps/windsurf-plugin/src/hooks/user-prompt-submit.ts
var HOOK_DIR = path3.dirname(fileURLToPath(import.meta.url));
var RESOLVE_BIN = path3.resolve(HOOK_DIR, "../cli/resolve.js");
function allow() {
  process.stdout.write(JSON.stringify({ continue: true }));
}
function isTrivial(prompt) {
  const trimmed = prompt.trim();
  return !trimmed || trimmed.split(/\s+/).filter(Boolean).length < 4;
}
async function hasToken() {
  try {
    const raw = await fs3.readFile(
      path3.join(os3.homedir(), ".config", "memlin", "token.json"),
      "utf8"
    );
    return Boolean(JSON.parse(raw).access_token);
  } catch {
    return false;
  }
}
function emitAdditionalContext(additional) {
  process.stdout.write(
    JSON.stringify({
      continue: true,
      additional_context: additional,
      hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: additional }
    })
  );
}
async function main() {
  const input = await readHookInput();
  const prompt = input?.prompt ?? "";
  const cwd = input?.cwd ?? input?.workspace_roots?.[0] ?? process.cwd();
  if (isTrivial(prompt) || !await hasToken()) {
    allow();
    return;
  }
  const scribeNotice = await takeScribeNotice();
  const sessionId = input?.session_id ?? input?.conversation_id ?? null;
  try {
    const state = await readState();
    if (state.last_resolve && isContinuation(prompt, cwd, "windsurf", state.last_resolve, sessionId)) {
      emitAdditionalContext(scribeNotice + buildContinuityMarker(state.last_resolve.audit_id));
      return;
    }
  } catch {
  }
  const lateBundle = await takePendingBundle(cwd, "windsurf");
  const outcome = await runResolveWithBudget({
    resolveBin: RESOLVE_BIN,
    task: prompt,
    cwd,
    host: "windsurf",
    sessionId
  });
  if (outcome.bundle?.rendered) {
    const block = [
      "<memlin-resolved-context>",
      "# Auto-resolved by Memlin for the prompt below. Authoritative project",
      "# context \u2014 apply skills, honor goals, validate schemas, cite sources.",
      "",
      outcome.bundle.rendered,
      "</memlin-resolved-context>"
    ].join("\n");
    emitAdditionalContext(scribeNotice + block);
    return;
  }
  if (lateBundle) {
    emitAdditionalContext(scribeNotice + buildLateDeliveryEnvelope(lateBundle));
    return;
  }
  if (scribeNotice) emitAdditionalContext(scribeNotice);
  else allow();
}
main().catch(() => {
  allow();
  process.exit(0);
});
