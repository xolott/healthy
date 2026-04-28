import { describe, expect, it } from 'vitest';

import * as schema from '../src/schema/index.js';

describe('schema entrypoint', () => {
  it('is an importable namespace for Drizzle', () => {
    expect(schema).toBeDefined();
    expect(typeof schema).toBe('object');
  });
});
