#!/usr/bin/env node
import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);
import { fileURLToPath as __ftp } from 'node:url'; import { dirname as __dn } from 'node:path';
const __filename = __ftp(import.meta.url); const __dirname = __dn(__filename);

// packages/plugin-core/src/cli/init.ts
import readline from "node:readline/promises";

// packages/plugin-core/src/client.ts
import { promises as fs3 } from "node:fs";
import path4 from "node:path";
import os4 from "node:os";
import { randomUUID as randomUUID3 } from "node:crypto";

// packages/plugin-core/src/auth.ts
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
var MEMLIN_PROD_AUTH0_DOMAIN = "memlin.us.auth0.com";
var MEMLIN_PROD_AUTH0_CLIENT_ID = "fyYMQ4Cxc6Nu5juVwL8Ihqq4fgAFecG9";
var AUTH0_DOMAIN = process.env.MEMLIN_AUTH0_DOMAIN || MEMLIN_PROD_AUTH0_DOMAIN;
var AUTH0_CLIENT_ID = process.env.MEMLIN_AUTH0_CLIENT_ID || MEMLIN_PROD_AUTH0_CLIENT_ID;
var AUTH0_AUDIENCE = process.env.MEMLIN_AUTH0_AUDIENCE ?? "https://api.memlin.ai";
function persistedTokenFilePath() {
  return process.env.MEMLIN_TOKEN_FILE || path.join(os.homedir(), ".config", "memlin", "token.json");
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
  await fs.mkdir(path.dirname(file), { recursive: true });
  const deadline = Date.now() + AUTH_FILE_LOCK_TIMEOUT_MS;
  while (true) {
    try {
      const handle = await fs.open(file, "wx", 384);
      try {
        await handle.writeFile(owner, "utf8");
        await handle.sync();
      } catch (error) {
        await handle.close().catch(() => {
        });
        await fs.rm(file, { force: true }).catch(() => {
        });
        throw error;
      }
      let released = false;
      return async () => {
        if (released) return;
        released = true;
        await handle.close().catch(() => {
        });
        const currentOwner = await fs.readFile(file, "utf8").catch(() => null);
        if (currentOwner === owner) await fs.rm(file, { force: true }).catch(() => {
        });
      };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      try {
        const stat = await fs.stat(file);
        if (Date.now() - stat.mtimeMs > AUTH_FILE_LOCK_STALE_MS) {
          await fs.rm(file, { force: true });
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
async function writePersistedToken(t) {
  const file = persistedTokenFilePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = path.join(
    path.dirname(file),
    `${path.basename(file)}.tmp-${process.pid}-${randomUUID()}`
  );
  await fs.writeFile(tmp, JSON.stringify(t, null, 2), { mode: 384 });
  await fs.chmod(tmp, 384).catch(() => {
  });
  await fs.rename(tmp, file);
}
function decodeJwtPayload(jwt) {
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("not a JWT");
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
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
import { randomUUID as randomUUID2 } from "node:crypto";
import { constants, promises as fs2 } from "node:fs";
import path3 from "node:path";
var GIT_POINTER_MAX_BYTES = 8 * 1024;

// packages/plugin-core/src/client.ts
function globalConfigFilePath() {
  return process.env.MEMLIN_CONFIG_FILE || path4.join(os4.homedir(), ".config", "memlin", "config.json");
}
var CONFIG_DIR = path4.join(os4.homedir(), ".config", "memlin");
var TOKEN_FILE = path4.join(CONFIG_DIR, "token.json");
async function writeGlobalConfig(config) {
  const file = globalConfigFilePath();
  await fs3.mkdir(path4.dirname(file), { recursive: true });
  const tmp = path4.join(
    path4.dirname(file),
    `${path4.basename(file)}.tmp-${process.pid}-${randomUUID3()}`
  );
  await fs3.writeFile(tmp, JSON.stringify(config, null, 2), { mode: 384 });
  await fs3.chmod(tmp, 384).catch(() => {
  });
  await fs3.rename(tmp, file);
}
function accessTokenSubject(accessToken) {
  try {
    const subject = decodeJwtPayload(accessToken).sub;
    return typeof subject === "string" && subject.length > 0 ? subject : null;
  } catch {
    return null;
  }
}

// packages/plugin-core/src/login-bootstrap.ts
import { promises as fs5 } from "node:fs";
import path6 from "node:path";
import { randomUUID as randomUUID4 } from "node:crypto";

// packages/plugin-core/src/plugin-install.ts
import { promises as fs4 } from "node:fs";
import { existsSync } from "node:fs";
import path5 from "node:path";
import os5 from "node:os";

// packages/plugin-core/src/login-bootstrap.ts
var LoginBootstrapError = class extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.code = code;
  }
  code;
  name = "LoginBootstrapError";
};
var DEFAULT_PUBLICATION_DEPENDENCIES = {
  writeConfig: writeGlobalConfig,
  writeToken: writePersistedToken
};
async function readSnapshot(file) {
  try {
    return await fs5.readFile(file);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
async function restoreSnapshot(file, snapshot) {
  if (snapshot === null) {
    await fs5.rm(file, { force: true });
    return;
  }
  await fs5.mkdir(path6.dirname(file), { recursive: true });
  const tmp = path6.join(
    path6.dirname(file),
    `${path6.basename(file)}.rollback-${process.pid}-${randomUUID4()}`
  );
  await fs5.writeFile(tmp, snapshot, { mode: 384 });
  await fs5.chmod(tmp, 384).catch(() => {
  });
  await fs5.rename(tmp, file);
}
async function publishMemlinLoginPair(config, token, dependencies = {}) {
  if (!config.auth0_sub || accessTokenSubject(token.access_token) !== config.auth0_sub) {
    throw new LoginBootstrapError(
      "identity-mismatch",
      "The authenticated identity does not match the Memlin account profile."
    );
  }
  const configFile = globalConfigFilePath();
  const tokenFile = persistedTokenFilePath();
  const writers = { ...DEFAULT_PUBLICATION_DEPENDENCIES, ...dependencies };
  try {
    await withAuthFileLock(async () => {
      const previousConfig = await readSnapshot(configFile);
      const previousToken = await readSnapshot(tokenFile);
      try {
        await writers.writeConfig(config);
        await writers.writeToken(token);
      } catch (error) {
        const rollback = await Promise.allSettled([
          restoreSnapshot(configFile, previousConfig),
          restoreSnapshot(tokenFile, previousToken)
        ]);
        const rollbackFailed = rollback.some((result) => result.status === "rejected");
        throw new LoginBootstrapError(
          "publication-failed",
          rollbackFailed ? "Memlin sign-in could not be saved or safely rolled back. Restart Companion and sign in again." : "Memlin sign-in could not be saved. The previous local account remains active.",
          { cause: error }
        );
      }
    });
  } catch (error) {
    if (error instanceof LoginBootstrapError) throw error;
    throw new LoginBootstrapError(
      "publication-failed",
      "Memlin could not lock the shared sign-in files. Try again.",
      { cause: error }
    );
  }
}

// packages/plugin-core/src/cli/init.ts
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
  let auth0_sub = "";
  let expires_at = Date.now() + 24 * 36e5;
  try {
    const parts = access_token.split(".");
    if (parts.length < 2 || !parts[1]) throw new Error("not a JWT");
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    const ids = payload.memlin_account_ids;
    account_id = payload.memlin_default_account_id ?? ids?.[0] ?? "";
    auth0_sub = payload.sub ?? "";
    user_id = payload.memlin_user_id ?? auth0_sub;
    if (typeof payload.exp === "number" && Number.isFinite(payload.exp)) {
      expires_at = payload.exp * 1e3;
    }
  } catch {
    console.error("couldn't decode access token JWT \u2014 paste it raw, no surrounding quotes.");
    rl.close();
    process.exit(1);
  }
  if (!account_id || !user_id || !auth0_sub) {
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
    auth0_sub,
    project_id: null
  };
  await publishMemlinLoginPair(config, { access_token, expires_at });
  console.log("");
  console.log(`\u2713 wrote ${globalConfigFilePath()}`);
  console.log(`\u2713 account ${account_id.slice(0, 8)}\u2026  user ${user_id.slice(0, 12)}\u2026`);
  console.log("");
  console.log("Try: `node ~/.claude/plugins/memlin/dist/cli/status.js`");
}
main().catch((err) => {
  console.error("memlin init failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
