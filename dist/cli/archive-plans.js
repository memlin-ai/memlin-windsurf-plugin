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
import { promises as fs } from "node:fs";
import path2 from "node:path";
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
    entries = await fs.readdir(plansDir, { withFileTypes: true });
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
    const stat = await fs.stat(path2.join(plansDir, ent.name));
    out.push({ file: ent.name, slug: parsed.slug, mtimeMs: stat.mtimeMs });
  }
  return out;
}
function archiveDirFor(plansDir, now) {
  const y = now.getUTCFullYear().toString().padStart(4, "0");
  const m = (now.getUTCMonth() + 1).toString().padStart(2, "0");
  const d = now.getUTCDate().toString().padStart(2, "0");
  return path2.join(plansDir, ".archived", `${y}-${m}-${d}`);
}
async function archiveFiles(plansDir, files, now) {
  const archiveDir = archiveDirFor(plansDir, now);
  await fs.mkdir(archiveDir, { recursive: true });
  let archived = 0;
  for (const f of files) {
    const src = path2.join(plansDir, f.file);
    const dst = path2.join(archiveDir, f.file);
    await fs.rename(src, dst);
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
    process.stdout.write(
      "\ndry-run (pass --apply to archive). Archive is reversible: files move to .archived/<date>/, never deleted.\n"
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
