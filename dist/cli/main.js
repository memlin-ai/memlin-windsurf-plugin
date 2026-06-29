#!/usr/bin/env node
import { printCommandGuide } from "./command-guide.js";
const RUN = {
  login: () => import("./login.js"),
  init: () => import("./init.js"),
  status: () => import("./status.js"),
  doctor: () => import("./doctor.js"),
  sync: () => import("./sync.js"),
  pull: () => import("./pull.js"),
  push: () => import("./push.js"),
  "pull-plans": () => import("./pull-plans.js"),
  "push-plan": () => import("./push-plan.js"),
  "bind-plans": () => import("./bind-plans.js"),
  "archive-plans": () => import("./archive-plans.js"),
  resolve: () => import("./resolve.js"),
  ask: () => import("./ask.js"),
  verify: () => import("./verify.js"),
  diff: () => import("./diff.js"),
  scribe: () => import("./scribe.js"),
  inbox: () => import("./inbox.js"),
  handoffs: () => import("./handoffs.js"),
  features: () => import("./features.js"),
  link: () => import("./link.js"),
  revert: () => import("./revert.js"),
  pin: () => import("./pin.js"),
  "add-project": () => import("./add-project.js"),
  "manage-memory": () => import("./manage-memory.js"),
  "managed-memory": () => import("./managed-memory.js"),
  // back-compat alias
  "ingest-native-memory": () => import("./ingest-native-memory.js"),
  "attach-path": () => import("./attach-path.js"),
  "audit-replay": () => import("./audit-replay.js"),
  "audit-explain": () => import("./audit-explain.js"),
  "actions-list": () => import("./actions-list.js"),
  "actions-execute": () => import("./actions-execute.js"),
  "prompt-ci": () => import("./prompt-ci.js"),
  scan: () => import("./scan.js")
};
async function main() {
  let sub = process.argv[2];
  if (sub === "audit") {
    const action = process.argv[3];
    if (action === "explain" || action === "replay") {
      sub = `audit-${action}`;
      process.argv.splice(3, 1);
    }
  }
  if (!sub || sub === "--help" || sub === "-h" || sub === "help") {
    printCommandGuide({ write: (line) => process.stdout.write(line + "\n") });
    process.exit(sub ? 0 : 1);
  }
  const run = RUN[sub];
  if (!run) {
    process.stderr.write(`memlin: unknown command '${sub}'. Run 'memlin --help' for the list.
`);
    process.exit(1);
  }
  process.argv.splice(2, 1);
  await run();
}
main().catch((err) => {
  process.stderr.write(`memlin: ${err instanceof Error ? err.message : String(err)}
`);
  process.exit(1);
});
