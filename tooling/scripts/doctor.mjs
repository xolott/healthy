#!/usr/bin/env node
/**
 * Surfaces toolchain presence for contributors.
 */

import { execSync } from "node:child_process";

function which(cmd, args = ["--version"]) {
  try {
    const out = execSync(`${cmd} ${args.join(" ")}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return out.trim().split("\n")[0];
  } catch {
    return null;
  }
}

console.log("healthy doctor");
console.log("node:", process.version);
console.log("pnpm:", which("pnpm") ?? "(missing)");
console.log("corepack:", which("corepack") ?? "(optional)");
console.log("flutter:", which("flutter", ["--version"]) ?? "(missing)");
console.log("dart:", which("dart", ["--version"]) ?? "(optional)");
