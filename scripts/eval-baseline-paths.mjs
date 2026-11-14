import fs from "node:fs";
import path from "node:path";

export const DEFAULT_SNAPSHOT = ".local/dify-snapshots/catalog-outfit-evaluation-20261111-local";

export function resolveSnapshot(input = DEFAULT_SNAPSHOT) {
  const parent = fs.realpathSync(".local/dify-snapshots");
  const root = fs.realpathSync(input);
  if (path.dirname(root) !== parent || !fs.statSync(root).isDirectory()) {
    throw new Error("Expected a baseline directory immediately inside .local/dify-snapshots");
  }
  return root;
}

export function resolveRun(input) {
  if (!input) throw new Error("Expected a run directory");
  const dir = fs.realpathSync(input);
  const runs = path.dirname(dir);
  const root = resolveSnapshot(path.dirname(runs));
  if (path.basename(runs) !== "runs" || !fs.statSync(dir).isDirectory()) {
    throw new Error("Expected a run directory inside a baseline's runs folder");
  }
  return { root, dir };
}
