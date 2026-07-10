#!/usr/bin/env node
import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);

// apps/windsurf-plugin/src/hooks/post-tool-use.ts
import { spawn } from "node:child_process";
import path2 from "node:path";
import { fileURLToPath } from "node:url";

// packages/plugin-core/dist/host.js
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
  const envHost = process.env.MEMLIN_HOST ?? (process.env.CURSOR_AGENT ? "cursor" : "claude-code");
  const make = HOSTS[envHost];
  return (make ?? HOSTS["claude-code"])();
}

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

// apps/windsurf-plugin/src/hooks/post-tool-use.ts
var HOOK_DIR = path2.dirname(fileURLToPath(import.meta.url));
var PUSH_PLAN_BIN = path2.resolve(HOOK_DIR, "../cli/push-plan.js");
function editedFile(input) {
  return input?.file_path ?? input?.path ?? input?.tool_input?.file_path ?? input?.tool_input?.path ?? "";
}
async function main() {
  process.env.MEMLIN_HOST = "windsurf";
  const input = await readHookInput();
  const file = editedFile(input);
  const plansDir = resolveHost().plansDir();
  const abs = file ? path2.resolve(file) : "";
  if (abs && abs.startsWith(plansDir + path2.sep) && abs.endsWith(".md")) {
    try {
      const child = spawn(process.execPath, [PUSH_PLAN_BIN, abs], {
        env: { ...process.env, MEMLIN_HOST: "windsurf" },
        detached: true,
        stdio: "ignore"
      });
      child.unref();
    } catch {
    }
  }
  process.stdout.write("{}");
}
main().catch(() => {
  process.stdout.write("{}");
  process.exit(0);
});
