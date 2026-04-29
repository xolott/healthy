/**
 * Pantry routes with injected {@link RequestScope}: persistence outcomes flow through
 * capabilities without tests depending on Postgres or database adapter internals.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../src/app.js';
import type { RequestScope } from '../src/request-scope/index.js';
import { unusedPantryCapability } from './helpers/unused-pantry-scope.js';

const authScopeUnavailable: RequestScope = {
  status: {
    async isFirstOwnerSetupRequired() {
      return { kind: 'ok', isFirstOwnerSetupRequired: false };
    },
  },
  currentSession: {
    async resolveFromRawToken() {
      return { kind: 'persistence_unavailable' };
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
};

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

describe('Pantry routes — request-scope persistence outcomes', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('GET /pantry/reference returns 503 when current session resolves to persistence_unavailable', async () => {
    vi.stubEnv('DATABASE_URL', '');
    const app = await buildApp({ requestScope: authScopeUnavailable });
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/pantry/reference',
        headers: { authorization: 'Bearer sometoken', accept: 'application/json' },
      });
      expect(res.statusCode).toBe(503);
      expect(JSON.parse(res.payload)).toEqual({ error: 'service_unavailable' });
    } finally {
      await app.close();
    }
  });

  it('GET /pantry/items returns 503 when current session resolves to persistence_unavailable', async () => {
    vi.stubEnv('DATABASE_URL', '');
    const app = await buildApp({ requestScope: authScopeUnavailable });
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/pantry/items?itemType=food',
        headers: { authorization: 'Bearer sometoken', accept: 'application/json' },
      });
      expect(res.statusCode).toBe(503);
      expect(JSON.parse(res.payload)).toEqual({ error: 'service_unavailable' });
    } finally {
      await app.close();
    }
  });

  it('GET /pantry/items/:itemId returns 503 when pantry getItem reports persistence_unavailable after session ok', async () => {
    vi.stubEnv('DATABASE_URL', '');
    const pantry: RequestScope['pantry'] = {
      ...unusedPantryCapability(),
      async getItemForOwner(_ownerUserId, _itemId) {
        return { kind: 'persistence_unavailable' };
      },
    };
    const app = await buildApp({
      requestScope: {
        ...authScopeUnavailable,
        currentSession: {
          async resolveFromRawToken() {
            return okOwnerSession();
          },
        },
        pantry,
      },
    });
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/pantry/items/550e8400-e29b-41d4-a716-446655440000',
        headers: { authorization: 'Bearer tok', accept: 'application/json' },
      });
      expect(res.statusCode).toBe(503);
      expect(JSON.parse(res.payload)).toEqual({ error: 'service_unavailable' });
    } finally {
      await app.close();
    }
  });

  it('POST /pantry/items/food returns 400 invalid_input from pantry capability (no database)', async () => {
    vi.stubEnv('DATABASE_URL', '');
    const pantry: RequestScope['pantry'] = {
      ...unusedPantryCapability(),
      async createFoodForOwner() {
        return {
          kind: 'invalid_input',
          field: 'nutrients',
          message: 'Controlled validation outcome.',
        };
      },
    };
    const app = await buildApp({
      requestScope: {
        ...authScopeUnavailable,
        currentSession: {
          async resolveFromRawToken() {
            return okOwnerSession();
          },
        },
        pantry,
      },
    });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/pantry/items/food',
        headers: { authorization: 'Bearer tok', accept: 'application/json', 'content-type': 'application/json' },
        payload: {
          name: 'X',
          iconKey: 'food_apple',
          baseAmount: { value: 1, unit: 'g' },
          nutrients: { calories: 1, protein: 0, fat: 0, carbohydrates: 0 },
        },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload) as { error: string; field: string };
      expect(body.error).toBe('invalid_input');
      expect(body.field).toBe('nutrients');
    } finally {
      await app.close();
    }
  });
});
