#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "services", "api", "dist");
await fs.rm(root, { recursive: true, force: true }).catch(() => {});
console.log("clean-api-dist.mjs: removed services/api/dist (if existed)");
