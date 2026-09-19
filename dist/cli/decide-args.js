import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);
import { fileURLToPath as __ftp } from 'node:url'; import { dirname as __dn } from 'node:path';
const __filename = __ftp(import.meta.url); const __dirname = __dn(__filename);

// packages/plugin-core/src/cli/decide-args.ts
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value) {
  return UUID_RE.test(value);
}
function extractNoteFlag(args) {
  const rest = [];
  let note = null;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--note") {
      const value = args[i + 1];
      if (value === void 0 || value.startsWith("--")) {
        return { args: rest, note: null, error: 'missing value for --note \u2014 use --note "your reason"' };
      }
      note = value;
      i++;
      continue;
    }
    if (arg.startsWith("--note=")) {
      note = arg.slice("--note=".length);
      continue;
    }
    rest.push(arg);
  }
  const trimmed = note?.trim() ?? "";
  return { args: rest, note: trimmed ? trimmed : null, error: null };
}
var DECIDE_USAGE = 'usage: memlin decide <id> <option> [--note "why"]';
function parseDecideArgs(args) {
  const split = extractNoteFlag(args);
  if (split.error) return { error: split.error };
  const unknown = split.args.find((a) => a.startsWith("--"));
  if (unknown) return { error: `unknown flag ${unknown} \u2014 ${DECIDE_USAGE}` };
  const [id, option, ...extra] = split.args;
  if (!id || !option) return { error: DECIDE_USAGE };
  if (extra.length > 0) {
    return { error: `unexpected argument "${extra[0]}" \u2014 quote the note: --note "\u2026"` };
  }
  return { id, option, note: split.note };
}
function matchById(items, needle, noun = "open decision") {
  const exact = items.find((d) => d.id === needle);
  if (exact) return exact;
  const matches = items.filter((d) => d.id.startsWith(needle));
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) return { error: `no ${noun} matches "${needle}"` };
  return {
    error: `"${needle}" is ambiguous \u2014 matches ${matches.length} ${noun}s; use more characters`
  };
}
export {
  DECIDE_USAGE,
  extractNoteFlag,
  isUuid,
  matchById,
  parseDecideArgs
};
