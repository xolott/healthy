import type { FastifyInstance, FastifyReply } from 'fastify';

import { getSessionTokenFromRequest } from '../auth/parse-bearer-cookie.js';
import type {
  PublicPantryItemDetailOutcome,
  PublicPantryItemsListOutcome,
  PublicPantryReferenceOutcome,
} from '../request-scope/index.js';
import { createRequestScopeForApp, type RequestScope } from '../request-scope/index.js';

const pantryReferenceResponse = {
  type: 'object',
  additionalProperties: false,
  required: ['nutrients', 'iconKeys'],
  properties: {
    nutrients: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'displayName', 'canonicalUnit'],
        properties: {
          key: { type: 'string' },
          displayName: { type: 'string' },
          canonicalUnit: { type: 'string' },
        },
      },
    },
    iconKeys: { type: 'array', items: { type: 'string' } },
  },
} as const;

const pantryItemsListResponse = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'itemType', 'name', 'iconKey', 'metadata', 'createdAt', 'updatedAt'],
        properties: {
          id: { type: 'string' },
          itemType: { type: 'string', enum: ['food', 'recipe'] },
          name: { type: 'string' },
          iconKey: { type: 'string' },
          metadata: {
            type: 'object',
            additionalProperties: true,
          },
          createdAt: { type: 'string' },
          updatedAt: { type: 'string' },
        },
      },
    },
  },
} as const;

const pantryItemDetailResponse = {
  type: 'object',
  additionalProperties: false,
  required: ['item'],
  properties: {
    item: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'itemType', 'name', 'iconKey', 'metadata', 'createdAt', 'updatedAt'],
      properties: {
        id: { type: 'string' },
        itemType: { type: 'string', enum: ['food', 'recipe'] },
        name: { type: 'string' },
        iconKey: { type: 'string' },
        metadata: { type: 'object', additionalProperties: true },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
      },
    },
  },
} as const;

const authErrorBody = {
  type: 'object',
  additionalProperties: false,
  required: ['error'],
  properties: {
    error: { type: 'string', enum: ['unauthorized'] },
  },
} as const;

const badRequestBody = {
  type: 'object',
  additionalProperties: false,
  required: ['error'],
  properties: {
    error: { type: 'string', enum: ['invalid_query'] },
  },
} as const;

const notFoundBody = {
  type: 'object',
  additionalProperties: false,
  required: ['error'],
  properties: {
    error: { type: 'string', enum: ['not_found'] },
  },
} as const;

const svcUnavailableBody = {
  type: 'object',
  additionalProperties: false,
  required: ['error'],
  properties: {
    error: { type: 'string', enum: ['service_unavailable'] },
  },
} as const;

function resolveRequestScope(app: FastifyInstance, scope: RequestScope | undefined): RequestScope {
  return scope ?? createRequestScopeForApp(app);
}

function sendSvc(reply: FastifyReply) {
  return reply.status(503).send({ error: 'service_unavailable' });
}

function resolveItemType(raw: unknown): 'food' | 'recipe' | null {
  if (raw === 'food' || raw === 'recipe') {
    return raw;
  }
  return null;
}

function sendListOutcome(reply: FastifyReply, outcome: PublicPantryItemsListOutcome) {
  switch (outcome.kind) {
    case 'persistence_not_configured':
    case 'persistence_unavailable':
      return sendSvc(reply);
    case 'ok':
      return reply.status(200).send({ items: outcome.items });
    default: {
      const _: never = outcome;
      return _;
    }
  }
}

function sendDetailOutcome(reply: FastifyReply, outcome: PublicPantryItemDetailOutcome) {
  switch (outcome.kind) {
    case 'persistence_not_configured':
    case 'persistence_unavailable':
      return sendSvc(reply);
    case 'not_found':
      return reply.status(404).send({ error: 'not_found' });
    case 'ok':
      return reply.status(200).send({ item: outcome.item });
    default: {
      const _: never = outcome;
      return _;
    }
  }
}

function sendReferenceOutcome(reply: FastifyReply, outcome: PublicPantryReferenceOutcome) {
  switch (outcome.kind) {
    case 'persistence_not_configured':
    case 'persistence_unavailable':
      return sendSvc(reply);
    case 'ok':
      return reply.status(200).send({
        nutrients: outcome.nutrients,
        iconKeys: [...outcome.iconKeys],
      });
    default: {
      const _: never = outcome;
      return _;
    }
  }
}

export async function registerPantryRoutes(app: FastifyInstance, requestScope?: RequestScope) {
  const scope = resolveRequestScope(app, requestScope);

  app.get(
    '/pantry/reference',
    {
      schema: {
        summary: 'Nutrient catalog and stable icon keys',
        description:
          'Returns the app-wide nutrient catalog (seeded) and ordered stable icon wire keys; requires an authenticated session.',
        response: {
          200: pantryReferenceResponse,
          401: authErrorBody,
          503: svcUnavailableBody,
        },
      },
    },
    async (request, reply) => {
      const t = getSessionTokenFromRequest({
        authorization: request.headers.authorization,
        cookie: request.headers.cookie,
      });
      if (t.token === undefined) {
        return reply.status(401).send({ error: 'unauthorized' });
      }
      const sessionOutcome = await scope.currentSession.resolveFromRawToken(t.token);
      if (sessionOutcome.kind === 'persistence_not_configured' || sessionOutcome.kind === 'persistence_unavailable') {
        return sendSvc(reply);
      }
      if (sessionOutcome.kind !== 'ok') {
        return reply.status(401).send({ error: 'unauthorized' });
      }
      const ref = await scope.pantry.getReferenceCatalog();
      return sendReferenceOutcome(reply, ref);
    },
  );

  app.get(
    '/pantry/items',
    {
      schema: {
        summary: 'List Pantry items for the current user',
        description: 'Lists Foods or Recipes owned by the authenticated user (empty catalog is valid).',
        querystring: {
          type: 'object',
          required: ['itemType'],
          properties: {
            itemType: { type: 'string', enum: ['food', 'recipe'] },
          },
        },
        response: {
          200: pantryItemsListResponse,
          400: badRequestBody,
          401: authErrorBody,
          503: svcUnavailableBody,
        },
      },
    },
    async (request, reply) => {
      const q = request.query as Record<string, unknown>;
      const itemType = resolveItemType(q['itemType']);
      if (itemType === null) {
        return reply.status(400).send({ error: 'invalid_query' });
      }
      const t = getSessionTokenFromRequest({
        authorization: request.headers.authorization,
        cookie: request.headers.cookie,
      });
      if (t.token === undefined) {
        return reply.status(401).send({ error: 'unauthorized' });
      }
      const sessionOutcome = await scope.currentSession.resolveFromRawToken(t.token);
      if (sessionOutcome.kind === 'persistence_not_configured' || sessionOutcome.kind === 'persistence_unavailable') {
        return sendSvc(reply);
      }
      if (sessionOutcome.kind !== 'ok') {
        return reply.status(401).send({ error: 'unauthorized' });
      }
      const listOutcome = await scope.pantry.listItemsForOwner(sessionOutcome.user.id, itemType);
      return sendListOutcome(reply, listOutcome);
    },
  );

  app.get(
    '/pantry/items/:itemId',
    {
      schema: {
        summary: 'Pantry item detail',
        description: 'Returns a single Pantry Item owned by the authenticated user.',
        params: {
          type: 'object',
          required: ['itemId'],
          properties: {
            itemId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: pantryItemDetailResponse,
          401: authErrorBody,
          404: notFoundBody,
          503: svcUnavailableBody,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { itemId?: string };
      const itemId = params.itemId;
      if (itemId === undefined || itemId === '') {
        return reply.status(404).send({ error: 'not_found' });
      }
      const t = getSessionTokenFromRequest({
        authorization: request.headers.authorization,
        cookie: request.headers.cookie,
      });
      if (t.token === undefined) {
        return reply.status(401).send({ error: 'unauthorized' });
      }
      const sessionOutcome = await scope.currentSession.resolveFromRawToken(t.token);
      if (sessionOutcome.kind === 'persistence_not_configured' || sessionOutcome.kind === 'persistence_unavailable') {
        return sendSvc(reply);
      }
      if (sessionOutcome.kind !== 'ok') {
        return reply.status(401).send({ error: 'unauthorized' });
      }
      const detailOutcome = await scope.pantry.getItemForOwner(sessionOutcome.user.id, itemId);
      return sendDetailOutcome(reply, detailOutcome);
    },
  );
}
