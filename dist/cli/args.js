import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);
import { fileURLToPath as __ftp } from 'node:url'; import { dirname as __dn } from 'node:path';
const __filename = __ftp(import.meta.url); const __dirname = __dn(__filename);

// packages/plugin-core/src/cli/args.ts
function parseSlashArgs(raw) {
  const tokens = [];
  let cur = "";
  let inSingle = false;
  let inDouble = false;
  let started = false;
  let i = 0;
  const flush = () => {
    if (started) {
      tokens.push(cur);
      cur = "";
      started = false;
    }
  };
  while (i < raw.length) {
    const ch = raw[i];
    if (inSingle) {
      if (ch === "'") {
        inSingle = false;
      } else {
        cur += ch;
      }
      i++;
      continue;
    }
    if (inDouble) {
      if (ch === "\\" && i + 1 < raw.length) {
        const next = raw[i + 1];
        if (next === '"' || next === "\\") {
          cur += next;
          i += 2;
          continue;
        }
        cur += ch;
        i++;
        continue;
      }
      if (ch === '"') {
        inDouble = false;
        i++;
        continue;
      }
      cur += ch;
      i++;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      started = true;
      i++;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      started = true;
      i++;
      continue;
    }
    if (ch === " " || ch === "	" || ch === "\n") {
      flush();
      i++;
      continue;
    }
    cur += ch;
    started = true;
    i++;
  }
  flush();
  return tokens;
}
function argvAsSlashArgs() {
  const raw = process.argv.slice(2).join(" ").trim();
  return parseSlashArgs(raw);
}
export {
  argvAsSlashArgs,
  parseSlashArgs
};
