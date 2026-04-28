import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let cached: string | undefined;

export function getApiSemver(): string {
  if (cached === undefined) {
    const pkgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
    const raw = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
    cached = typeof raw.version === 'string' ? raw.version : '0.0.0';
  }
  return cached;
}
