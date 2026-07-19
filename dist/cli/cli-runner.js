import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);
import { fileURLToPath as __ftp } from 'node:url'; import { dirname as __dn } from 'node:path';
const __filename = __ftp(import.meta.url); const __dirname = __dn(__filename);

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
function rethrowCliExit(err) {
  if (err instanceof CliExit) throw err;
}
function exitCli(code) {
  throw new CliExit(code);
}
function scheduleProcessExit(code) {
  process.exitCode = code;
  void closeHttpSockets();
  setTimeout(() => process.exit(), WATCHDOG_MS).unref();
}
function runCliMain(main, onError) {
  main().then(
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
export {
  CliExit,
  exitCli,
  rethrowCliExit,
  runCliMain,
  scheduleProcessExit
};
