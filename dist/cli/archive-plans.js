#!/usr/bin/env node
import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);
import { fileURLToPath as __ftp } from 'node:url'; import { dirname as __dn } from 'node:path';
const __filename = __ftp(import.meta.url); const __dirname = __dn(__filename);

// packages/plugin-core/src/host.ts
import os from "node:os";
import path from "node:path";
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
    return path.join(this.home, "plans");
  }
};
var ClaudeCodeHost = class extends BaseHost {
  constructor() {
    super("claude-code", path.join(os.homedir(), ".claude"));
  }
};
var CursorHost = class extends BaseHost {
  constructor() {
    super("cursor", path.join(os.homedir(), ".config", "memlin"));
  }
};
var CodexHost = class extends BaseHost {
  constructor() {
    super("codex", path.join(os.homedir(), ".config", "memlin"));
  }
};
var WindsurfHost = class extends BaseHost {
  constructor() {
    super("windsurf", path.join(os.homedir(), ".config", "memlin"));
  }
};
var AntigravityHost = class extends BaseHost {
  constructor() {
    super("antigravity", path.join(os.homedir(), ".config", "memlin"));
  }
};
var VSCodeHost = class extends BaseHost {
  constructor() {
    super("vscode", path.join(os.homedir(), ".config", "memlin"));
  }
};
var CompanionHost = class extends BaseHost {
  constructor() {
    super("companion", path.join(os.homedir(), ".config", "memlin"));
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

// packages/plugin-core/src/plan-archive.ts
import { promises as fs2, existsSync } from "node:fs";
import path3 from "node:path";

// packages/plugin-core/src/atomic-rename.ts
import { promises as fs } from "node:fs";
import path2 from "node:path";
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
      const delay = cap / 2 + Math.random() * (cap / 2);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
async function atomicRename(from, to, dependencies = {}) {
  const rename = dependencies.rename ?? fs.rename;
  const queueKey = path2.resolve(to);
  const previous = renameQueues.get(queueKey) ?? Promise.resolve();
  const run = previous.catch(() => void 0).then(() => renameWithRetry(from, to, rename));
  renameQueues.set(queueKey, run);
  try {
    await run;
  } finally {
    if (renameQueues.get(queueKey) === run) renameQueues.delete(queueKey);
  }
}

// packages/plugin-core/src/plan-archive.ts
var FILENAME_RE = /^(?<docId>[0-9a-f]{8})-(?<slug>.+)\.md$/i;
function parsePlanFilename(file) {
  const m = FILENAME_RE.exec(file);
  if (!m || !m.groups) return null;
  return { docId: m.groups.docId, slug: m.groups.slug };
}
function findDuplicateGroups(files) {
  const bySlug = /* @__PURE__ */ new Map();
  for (const f of files) {
    const arr = bySlug.get(f.slug);
    if (arr) arr.push(f);
    else bySlug.set(f.slug, [f]);
  }
  const out = [];
  for (const [slug, group] of bySlug) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => b.mtimeMs - a.mtimeMs);
    out.push({ slug, canonical: sorted[0], archive: sorted.slice(1) });
  }
  out.sort((a, b) => b.archive.length - a.archive.length);
  return out;
}
async function listPlanFiles(plansDir) {
  let entries;
  try {
    entries = await fs2.readdir(plansDir, { withFileTypes: true });
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
  const out = [];
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    if (ent.name.startsWith(".")) continue;
    const parsed = parsePlanFilename(ent.name);
    if (!parsed) continue;
    const stat = await fs2.stat(path3.join(plansDir, ent.name));
    out.push({ file: ent.name, slug: parsed.slug, mtimeMs: stat.mtimeMs });
  }
  return out;
}
function archiveDirFor(plansDir, now) {
  const y = now.getUTCFullYear().toString().padStart(4, "0");
  const m = (now.getUTCMonth() + 1).toString().padStart(2, "0");
  const d = now.getUTCDate().toString().padStart(2, "0");
  return path3.join(plansDir, ".archived", `${y}-${m}-${d}`);
}
function allocateArchiveDir(plansDir, now) {
  const base = archiveDirFor(plansDir, now);
  let dir = base;
  for (let n = 2; existsSync(dir); n += 1) dir = `${base}-${n}`;
  return dir;
}
function collisionFreeDestination(archiveDir, file) {
  const base = path3.join(archiveDir, file);
  if (!existsSync(base)) return base;
  const ext = path3.extname(base);
  const stem = base.slice(0, base.length - ext.length);
  for (let i = 1; i < 1e3; i += 1) {
    const candidate = `${stem}.${i}${ext}`;
    if (!existsSync(candidate)) return candidate;
  }
  return `${stem}.${Date.now()}${ext}`;
}
async function archiveFiles(plansDir, files, now) {
  const archiveDir = allocateArchiveDir(plansDir, now);
  await fs2.mkdir(archiveDir, { recursive: true });
  let archived = 0;
  for (const f of files) {
    const src = path3.join(plansDir, f.file);
    const dst = collisionFreeDestination(archiveDir, f.file);
    await atomicRename(src, dst);
    archived++;
  }
  return { archived, archiveDir };
}

// packages/plugin-core/src/cli/archive-plans.ts
async function main() {
  const apply = process.argv.slice(2).includes("--apply");
  const plansDir = resolveHost().plansDir();
  const files = await listPlanFiles(plansDir);
  if (files.length === 0) {
    process.stdout.write(`No plan files in ${plansDir}.
`);
    return;
  }
  const groups = findDuplicateGroups(files);
  if (groups.length === 0) {
    process.stdout.write(
      `No duplicates among ${files.length} plan file(s) in ${plansDir}.
`
    );
    return;
  }
  const totalArchive = groups.reduce((s, g) => s + g.archive.length, 0);
  process.stdout.write(
    `${groups.length} duplicated slug(s) in ${plansDir}, ${totalArchive} file(s) to archive (keeping newest per slug):

`
  );
  for (const g of groups) {
    const trimmed = g.slug.length > 60 ? `${g.slug.slice(0, 57)}\u2026` : g.slug;
    process.stdout.write(
      `  \xD7${String(g.archive.length + 1).padStart(4)}  ${trimmed}
        keep   ${g.canonical.file}
`
    );
  }
  if (!apply) {
    const target = allocateArchiveDir(plansDir, /* @__PURE__ */ new Date());
    process.stdout.write(
      `
dry-run (pass --apply to archive). Files would move to:
  ${target}
  Every run gets its own folder and nothing is ever deleted or overwritten,
  so an earlier archive is always still there to recover from.
`
    );
    return;
  }
  const toArchive = groups.flatMap((g) => g.archive);
  const { archived, archiveDir } = await archiveFiles(plansDir, toArchive, /* @__PURE__ */ new Date());
  process.stdout.write(
    `
\u2713 archived ${archived} file(s) \u2192 ${archiveDir}
  Recover any of them with: mv "${archiveDir}/<file>" "${plansDir}/"
`
  );
}
main().catch((err) => {
  process.stderr.write(
    `memlin archive-plans: ${err instanceof Error ? err.message : String(err)}
`
  );
  process.exit(1);
});
