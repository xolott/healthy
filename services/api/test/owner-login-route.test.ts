import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../src/app.js';
import { unusedFoodLogCapability } from './helpers/unused-food-log-scope.js';
import { unusedPantryCapability } from './helpers/unused-pantry-scope.js';
import { unusedReferenceFoodCapability } from './helpers/unused-reference-food-scope.js';

describe('POST /auth/login (unit)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 503 when DATABASE_URL is not configured', async () => {
    vi.stubEnv('DATABASE_URL', '');
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ email: 'a@b.com', password: 'x'.repeat(12) }),
      });
      expect(res.statusCode).toBe(503);
      expect(JSON.parse(res.payload)).toEqual({ error: 'service_unavailable' });
    } finally {
      await app.close();
    }
  });

  it('invokes Request Scope ownerLogin and maps invalid_credentials to 401', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/healthy_test');
    const app = await buildApp({
      requestScope: {
        status: {
          async isFirstOwnerSetupRequired() {
            return { kind: 'ok', isFirstOwnerSetupRequired: false };
          },
        },
        currentSession: {
          async resolveFromRawToken() {
            return { kind: 'unauthorized', reason: 'missing_session' };
          },
        },
        logout: {
          async logoutWithRawToken() {
            return { kind: 'skipped', reason: 'no_raw_token' };
          },
        },
        ownerLogin: {
          async loginWithEmailPassword() {
            return { kind: 'invalid_credentials' };
          },
        },
        firstOwnerSetup: {
          async setupFirstOwner() {
            return { kind: 'setup_unavailable' };
          },
        },
        pantry: unusedPantryCapability(),
        foodLog: unusedFoodLogCapability(),
        referenceFood: unusedReferenceFoodCapability(),
      },
    });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ email: 'a@b.com', password: 'anything' }),
      });
      expect(res.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it('returns 503 with service_unavailable when Request Scope reports persistence_unavailable', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/healthy_test');
    const app = await buildApp({
      requestScope: {
        status: {
          async isFirstOwnerSetupRequired() {
            return { kind: 'ok', isFirstOwnerSetupRequired: false };
          },
        },
        currentSession: {
          async resolveFromRawToken() {
            return { kind: 'unauthorized', reason: 'missing_session' };
          },
        },
        logout: {
          async logoutWithRawToken() {
            return { kind: 'skipped', reason: 'no_raw_token' };
          },
        },
        ownerLogin: {
          async loginWithEmailPassword() {
            return { kind: 'persistence_unavailable' };
          },
        },
        firstOwnerSetup: {
          async setupFirstOwner() {
            return { kind: 'setup_unavailable' };
          },
        },
        pantry: unusedPantryCapability(),
        foodLog: unusedFoodLogCapability(),
        referenceFood: unusedReferenceFoodCapability(),
      },
    });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ email: 'a@b.com', password: 'anything' }),
      });
      expect(res.statusCode).toBe(503);
      expect(JSON.parse(res.payload)).toEqual({ error: 'service_unavailable' });
    } finally {
      await app.close();
    }
  });
});
