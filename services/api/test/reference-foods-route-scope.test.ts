/**
 * Reference Food routes with injected {@link RequestScope}: outcomes flow without Elasticsearch.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../src/app.js';
import type { RequestScope } from '../src/request-scope/index.js';
import { unusedFoodLogCapability } from './helpers/unused-food-log-scope.js';
import { unusedPantryCapability } from './helpers/unused-pantry-scope.js';

function okOwnerSession() {
  return {
    kind: 'ok' as const,
    user: {
      id: '00000000-0000-4000-a000-000000000099',
      email: 'stub@example.com',
      displayName: 'Stub',
      role: 'owner' as const,
    },
  };
}

const authBase: Omit<RequestScope, 'referenceFood' | 'pantry'> = {
  status: {
    async isFirstOwnerSetupRequired() {
      return { kind: 'ok', isFirstOwnerSetupRequired: false };
    },
  },
  currentSession: {
    async resolveFromRawToken() {
      return okOwnerSession();
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
  foodLog: unusedFoodLogCapability(),
};

describe('Reference Food routes — request-scope outcomes', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('GET /reference-foods/search returns 503 when scope reports search_unavailable', async () => {
    vi.stubEnv('DATABASE_URL', '');
    const app = await buildApp({
      requestScope: {
        ...authBase,
        pantry: unusedPantryCapability(),
        referenceFood: {
          async searchActive() {
            return { kind: 'search_unavailable' };
          },
          async getActiveDetail() {
            return { kind: 'not_found' };
          },
        },
      },
    });
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/reference-foods/search?q=milk',
        headers: { authorization: 'Bearer tok', accept: 'application/json' },
      });
      expect(res.statusCode).toBe(503);
      expect(JSON.parse(res.payload)).toEqual({ error: 'service_unavailable' });
    } finally {
      await app.close();
    }
  });

  it('GET /reference-foods/:id returns 503 when detail reports persistence_unavailable', async () => {
    vi.stubEnv('DATABASE_URL', '');
    const app = await buildApp({
      requestScope: {
        ...authBase,
        pantry: unusedPantryCapability(),
        referenceFood: {
          async searchActive() {
            return { kind: 'ok', items: [] };
          },
          async getActiveDetail() {
            return { kind: 'persistence_unavailable' };
          },
        },
      },
    });
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/reference-foods/550e8400-e29b-41d4-a716-446655440000',
        headers: { authorization: 'Bearer tok', accept: 'application/json' },
      });
      expect(res.statusCode).toBe(503);
      expect(JSON.parse(res.payload)).toEqual({ error: 'service_unavailable' });
    } finally {
      await app.close();
    }
  });

  it('GET /reference-foods/search returns 401 without Authorization', async () => {
    vi.stubEnv('DATABASE_URL', '');
    const app = await buildApp({
      requestScope: {
        ...authBase,
        pantry: unusedPantryCapability(),
        referenceFood: {
          async searchActive() {
            return { kind: 'ok', items: [] };
          },
          async getActiveDetail() {
            return { kind: 'not_found' };
          },
        },
      },
    });
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/reference-foods/search?q=ab',
        headers: { accept: 'application/json' },
      });
      expect(res.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });
});
