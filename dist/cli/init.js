#!/usr/bin/env node
import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);

// packages/plugin-core/src/cli/init.ts
import readline from "node:readline/promises";
import { promises as fs4 } from "node:fs";
import path5 from "node:path";
import os5 from "node:os";

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
async function writePersistedToken(t) {
  const file = tokenFilePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = path.join(path.dirname(file), `token.json.tmp-${process.pid}`);
  await fs.writeFile(tmp, JSON.stringify(t, null, 2), { mode: 384 });
  await fs.chmod(tmp, 384).catch(() => {
  });
  await fs.rename(tmp, file);
}

// packages/plugin-core/src/memlin-api-client.ts
import { readFileSync } from "node:fs";
import os3 from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// packages/plugin-core/src/host.ts
import os2 from "node:os";
import path2 from "node:path";

// packages/plugin-core/src/memlin-api-client.ts
var DEFAULT_API_URL = "https://memlin.ai/api/v1";

// packages/plugin-core/src/workspace-binding.ts
import { promises as fs2 } from "node:fs";
import path3 from "node:path";

// packages/plugin-core/src/client.ts
var CONFIG_DIR = path4.join(os4.homedir(), ".config", "memlin");
var CONFIG_FILE = path4.join(CONFIG_DIR, "config.json");
var TOKEN_FILE = path4.join(CONFIG_DIR, "token.json");
async function writeToken(token) {
  const persisted = {
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_at: token.expires_at ?? Date.now() + 24 * 36e5
    // 24h fallback
  };
  await writePersistedToken(persisted);
}

// packages/plugin-core/src/cli/init.ts
var CONFIG_DIR2 = path5.join(os5.homedir(), ".config", "memlin");
var CONFIG_FILE2 = path5.join(CONFIG_DIR2, "config.json");
async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  async function ask(prompt, fallback) {
    const hint = fallback ? ` [${fallback}]` : "";
    const ans = (await rl.question(`${prompt}${hint}: `)).trim();
    return ans || fallback || "";
  }
  console.log("memlin init  (paste-a-token fallback \u2014 prefer `memlin login`)");
  console.log("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
  console.log("");
  const apiUrl = await ask("Memlin API URL", process.env.MEMLIN_API_URL ?? DEFAULT_API_URL);
  const access_token = await ask("Access token (Auth0 JWT)");
  let account_id = "";
  let user_id = "";
  try {
    const parts = access_token.split(".");
    if (parts.length < 2 || !parts[1]) throw new Error("not a JWT");
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    const ids = payload.memlin_account_ids;
    account_id = payload.memlin_default_account_id ?? ids?.[0] ?? "";
    user_id = payload.sub ?? "";
  } catch {
    console.error("couldn't decode access token JWT \u2014 paste it raw, no surrounding quotes.");
    rl.close();
    process.exit(1);
  }
  if (!account_id || !user_id) {
    console.error(
      "token is missing memlin_account_ids / sub. Make sure the Auth0 Action is deployed."
    );
    rl.close();
    process.exit(1);
  }
  rl.close();
  const config = {
    api_url: apiUrl,
    account_id,
    user_id,
    project_id: null
  };
  await fs4.mkdir(CONFIG_DIR2, { recursive: true });
  await fs4.writeFile(CONFIG_FILE2, JSON.stringify(config, null, 2), "utf8");
  await writeToken({ access_token });
  console.log("");
  console.log(`\u2713 wrote ${CONFIG_FILE2}`);
  console.log(`\u2713 account ${account_id.slice(0, 8)}\u2026  user ${user_id.slice(0, 12)}\u2026`);
  console.log("");
  console.log("Try: `node ~/.claude/plugins/memlin/dist/cli/status.js`");
}
main().catch((err) => {
  console.error("memlin init failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
