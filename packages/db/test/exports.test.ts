import { describe, expect, it } from 'vitest';

import { createDb } from '../src/index.js';

describe('@healthy/db exports', () => {
  it('exposes createDb for consumers', () => {
    expect(typeof createDb).toBe('function');
  });
});
