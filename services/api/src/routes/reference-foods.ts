import type { FastifyInstance, FastifyReply } from 'fastify';

import { getSessionTokenFromRequest } from '../auth/parse-bearer-cookie.js';
import type {
  PublicReferenceFoodDetailOutcome,
  PublicReferenceFoodSearchOutcome,
  RequestScope,
} from '../request-scope/index.js';
import { createRequestScopeForApp } from '../request-scope/index.js';

const authErrorBody = {
  type: 'object',
  additionalProperties: false,
  required: ['error'],
  properties: {
    error: { type: 'string', enum: ['unauthorized'] },
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

const notFoundBody = {
  type: 'object',
  additionalProperties: false,
  required: ['error'],
  properties: {
    error: { type: 'string', enum: ['not_found'] },
  },
} as const;

const invalidInputBody = {
  type: 'object',
  additionalProperties: false,
  required: ['error', 'field', 'message'],
  properties: {
    error: { type: 'string', enum: ['invalid_input'] },
    field: { type: 'string' },
    message: { type: 'string' },
  },
} as const;

const macrosSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['baseAmountGrams', 'calories', 'proteinGrams', 'fatGrams', 'carbohydratesGrams'],
  properties: {
    baseAmountGrams: { type: 'number' },
    calories: { type: 'number' },
    proteinGrams: { type: 'number' },
    fatGrams: { type: 'number' },
    carbohydratesGrams: { type: 'number' },
  },
} as const;

const servingPreviewSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['label', 'gramWeight'],
  properties: {
    label: { type: 'string' },
    gramWeight: { type: ['number', 'null'] },
  },
} as const;

const referenceFoodSearchCardSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'source',
    'sourceFoodId',
    'displayName',
    'brand',
    'foodClass',
    'servingPreview',
    'macros',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    source: { type: 'string' },
    sourceFoodId: { type: 'string' },
    displayName: { type: 'string' },
    brand: { type: ['string', 'null'] },
    foodClass: { type: ['string', 'null'] },
    servingPreview: { anyOf: [{ type: 'null' }, servingPreviewSchema] },
    macros: macrosSchema,
  },
} as const;

const referenceFoodSearchResponse = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: referenceFoodSearchCardSchema,
    },
  },
} as const;

const referenceFoodDetailSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'source',
    'sourceFoodId',
    'displayName',
    'brand',
    'foodClass',
    'iconKey',
    'baseAmountGrams',
    'calories',
    'proteinGrams',
    'fatGrams',
    'carbohydratesGrams',
    'servings',
    'rawNutrients',
    'rawPayload',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    source: { type: 'string' },
    sourceFoodId: { type: 'string' },
    displayName: { type: 'string' },
    brand: { type: ['string', 'null'] },
    foodClass: { type: ['string', 'null'] },
    iconKey: { type: 'string' },
    baseAmountGrams: { type: 'number' },
    calories: { type: 'number' },
    proteinGrams: { type: 'number' },
    fatGrams: { type: 'number' },
    carbohydratesGrams: { type: 'number' },
    servings: {
      type: 'array',
      items: servingPreviewSchema,
    },
    rawNutrients: {
      type: 'array',
      items: { type: 'object', additionalProperties: true },
    },
    rawPayload: { type: 'object', additionalProperties: true },
  },
} as const;

const referenceFoodDetailResponse = {
  type: 'object',
  additionalProperties: false,
  required: ['food'],
  properties: {
    food: referenceFoodDetailSchema,
  },
} as const;

function resolveRequestScope(app: FastifyInstance, scope: RequestScope | undefined): RequestScope {
  return scope ?? createRequestScopeForApp(app);
}

function sendSvc(reply: FastifyReply) {
  return reply.status(503).send({ error: 'service_unavailable' });
}

function sendSearchOutcome(reply: FastifyReply, outcome: PublicReferenceFoodSearchOutcome) {
  switch (outcome.kind) {
    case 'persistence_not_configured':
      reply.log.warn(
        { referenceFoodSearchFailure: outcome.kind },
        'reference food search failed',
      );
      return sendSvc(reply);
    case 'persistence_unavailable':
      reply.log.warn(
        { referenceFoodSearchFailure: outcome.kind },
        'reference food search failed',
      );
      return sendSvc(reply);
    case 'search_unavailable':
      reply.log.warn(
        { referenceFoodSearchFailure: outcome.kind },
        'reference food search failed',
      );
      return sendSvc(reply);
    case 'invalid_input':
      reply.log.info(
        {
          referenceFoodSearchFailure: outcome.kind,
          field: outcome.field,
          message: outcome.message,
        },
        'reference food search rejected',
      );
      return reply.status(400).send({
        error: 'invalid_input',
        field: outcome.field,
        message: outcome.message,
      });
    case 'ok':
      return reply.status(200).send({ items: outcome.items });
    default: {
      const _: never = outcome;
      return _;
    }
  }
}

function sendDetailOutcome(reply: FastifyReply, outcome: PublicReferenceFoodDetailOutcome) {
  switch (outcome.kind) {
    case 'persistence_not_configured':
    case 'persistence_unavailable':
      return sendSvc(reply);
    case 'not_found':
      return reply.status(404).send({ error: 'not_found' });
    case 'ok':
      return reply.status(200).send({ food: outcome.food });
    default: {
      const _: never = outcome;
      return _;
    }
  }
}

async function requireOwnerUserId(
  request: { headers: { authorization?: string; cookie?: string } },
  reply: FastifyReply,
  scope: RequestScope,
): Promise<string | null> {
  const t = getSessionTokenFromRequest({
    authorization: request.headers.authorization,
    cookie: request.headers.cookie,
  });
  if (t.token === undefined) {
    await reply.status(401).send({ error: 'unauthorized' });
    return null;
  }
  const sessionOutcome = await scope.currentSession.resolveFromRawToken(t.token);
  if (sessionOutcome.kind === 'persistence_not_configured' || sessionOutcome.kind === 'persistence_unavailable') {
    await sendSvc(reply);
    return null;
  }
  if (sessionOutcome.kind !== 'ok') {
    await reply.status(401).send({ error: 'unauthorized' });
    return null;
  }
  return sessionOutcome.user.id;
}

export async function registerReferenceFoodRoutes(app: FastifyInstance, requestScope?: RequestScope) {
  const scope = resolveRequestScope(app, requestScope);

  app.get(
    '/reference-foods/search',
    {
      schema: {
        summary: 'Search active Reference Foods',
        description:
          'Full-text search over the Reference Food catalog (Elasticsearch ranking, Postgres hydration). Requires ELASTICSEARCH_URL for this endpoint.',
        querystring: {
          type: 'object',
          required: ['q'],
          properties: {
            q: { type: 'string', minLength: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 50 },
          },
        },
        response: {
          200: referenceFoodSearchResponse,
          400: invalidInputBody,
          401: authErrorBody,
          503: svcUnavailableBody,
        },
      },
    },
    async (request, reply) => {
      const ownerUserId = await requireOwnerUserId(request, reply, scope);
      if (ownerUserId === null) {
        return reply;
      }
      const q = request.query as Record<string, unknown>;
      const outcome = await scope.referenceFood.searchActive(ownerUserId, {
        q: q['q'],
        limit: q['limit'],
      });
      return sendSearchOutcome(reply, outcome);
    },
  );

  app.get(
    '/reference-foods/:referenceFoodId',
    {
      schema: {
        summary: 'Get Reference Food detail',
        description:
          'Returns full active Reference Food data from Postgres for serving selection and logging.',
        params: {
          type: 'object',
          required: ['referenceFoodId'],
          properties: {
            referenceFoodId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: referenceFoodDetailResponse,
          401: authErrorBody,
          404: notFoundBody,
          503: svcUnavailableBody,
        },
      },
    },
    async (request, reply) => {
      const ownerUserId = await requireOwnerUserId(request, reply, scope);
      if (ownerUserId === null) {
        return reply;
      }
      const params = request.params as { referenceFoodId?: string };
      const id = params.referenceFoodId;
      if (id === undefined || id === '') {
        return reply.status(404).send({ error: 'not_found' });
      }
      const outcome = await scope.referenceFood.getActiveDetail(ownerUserId, id);
      return sendDetailOutcome(reply, outcome);
    },
  );
}
