import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);
import { fileURLToPath as __ftp } from 'node:url'; import { dirname as __dn } from 'node:path';
const __filename = __ftp(import.meta.url); const __dirname = __dn(__filename);

// packages/plugin-core/src/cli/inbox-feature-args.ts
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function extractFeatureFlag(input) {
  const args = [];
  let feature;
  for (let i = 0; i < input.length; i++) {
    const arg = input[i];
    if (arg === "--feature" || arg === "--no-feature") {
      if (feature !== void 0) throw Error("Choose --feature or --no-feature once.");
      if (arg === "--no-feature") feature = "none";
      else {
        const id = input[++i];
        if (!id || !UUID.test(id)) throw Error("--feature needs a complete feature ID.");
        feature = { feature_id: id };
      }
    } else args.push(arg);
  }
  if (feature !== void 0 && args[0] !== "accept")
    throw Error("Filing choices apply only to accept.");
  return { args, feature };
}
export {
  extractFeatureFlag
};
