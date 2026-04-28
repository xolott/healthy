import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Base flat config for Healthy TypeScript packages (Node + ESM).
 * Consumer `eslint.config.js` should spread this and set `files` / `ignores`.
 *
 * @returns {import("eslint").Linter.Config[]}
 */
export function healthyEslintBase() {
  return [js.configs.recommended, ...tseslint.configs.recommended];
}
