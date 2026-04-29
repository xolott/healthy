import { describe, expect, it } from 'vitest';

import { createDatabaseAdapter, createDb, withDisposableDatabase } from '../src/index.js';

describe('@healthy/db exports', () => {
  it('exposes createDb for consumers', () => {
    expect(typeof createDb).toBe('function');
  });

  it('exposes createDatabaseAdapter for consumers', () => {
    expect(typeof createDatabaseAdapter).toBe('function');
  });

  it('exposes withDisposableDatabase for consumers', () => {
    expect(typeof withDisposableDatabase).toBe('function');
  });
});
