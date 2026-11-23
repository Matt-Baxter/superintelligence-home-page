import { register } from "node:module";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");

register(`data:text/javascript,${encodeURIComponent(`
import { existsSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const rootDir = ${JSON.stringify(rootDir)};
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("next/") && !specifier.endsWith(".js")) {
    return nextResolve(specifier + ".js", context);
  }
  if (specifier.startsWith("@/")) {
    const base = resolvePath(rootDir, specifier.slice(2));
    for (const c of [base, base + ".ts", base + ".tsx", resolvePath(base, "index.ts")]) {
      if (existsSync(c)) return nextResolve(pathToFileURL(c).href, context);
    }
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file://")) {
    const parentDir = dirname(fileURLToPath(context.parentURL));
    const base = resolvePath(parentDir, specifier);
    if (!existsSync(base)) {
      for (const c of [base + ".ts", base + ".tsx", resolvePath(base, "index.ts")]) {
        if (existsSync(c)) return nextResolve(pathToFileURL(c).href, context);
      }
    }
  }
  return nextResolve(specifier, context);
}
`)}`);
