#!/usr/bin/env node
/**
 * Cleans common artifacts outside turbo-managed outputs.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dirs = [
  ["apps", "admin", ".nuxt"],
  ["apps", "admin", ".output"],
  ["services", "api", "dist"],
  ["packages", "**"], // noop - skip glob, list explicit
];

async function rimraf(rel) {
  const p = path.join(root, ...rel);
  await fs.rm(p, { recursive: true, force: true }).catch(() => {});
}

async function main() {
  await rimraf(["apps", "admin", ".nuxt"]);
  await rimraf(["apps", "admin", ".output"]);
  await rimraf(["services", "api", "dist"]);
  console.log("clean.mjs done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
