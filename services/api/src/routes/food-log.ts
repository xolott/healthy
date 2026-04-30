import type { FastifyInstance, FastifyReply } from 'fastify';

import { getSessionTokenFromRequest } from '../auth/parse-bearer-cookie.js';
import { parseFoodLogLocalDateQuery } from '../food-log/plan-food-log-batch.js';
import type {
  PublicFoodLogBatchCreateOutcome,
  PublicFoodLogListOutcome,
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

const badRequestBody = {
  type: 'object',
  additionalProperties: false,
  required: ['error'],
  properties: {
    error: { type: 'string', enum: ['invalid_query'] },
  },
} as const;

const foodLogEntryItemResponse = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'pantryItemId',
    'displayName',
    'calories',
    'proteinGrams',
    'fatGrams',
    'carbohydratesGrams',
    'consumedDate',
  ],
  properties: {
    id: { type: 'string' },
    pantryItemId: { type: 'string' },
    displayName: { type: 'string' },
    calories: { type: 'number' },
    proteinGrams: { type: 'number' },
    fatGrams: { type: 'number' },
    carbohydratesGrams: { type: 'number' },
    consumedDate: { type: 'string' },
  },
} as const;

const foodLogEntriesListResponse = {
  type: 'object',
  additionalProperties: false,
  required: ['entries'],
  properties: {
    entries: { type: 'array', items: foodLogEntryItemResponse },
  },
} as const;

const recipeServingOptionBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['kind'],
  properties: {
    kind: { type: 'string', enum: ['base', 'unit', 'custom'] },
    unit: { type: 'string' },
    label: { type: 'string' },
  },
} as const;

const foodLogBatchBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['consumedAt', 'consumedDate', 'entries'],
  properties: {
    consumedAt: { type: 'string' },
    consumedDate: { type: 'string' },
    entries: {
      type: 'array',
      minItems: 1,
      maxItems: 64,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['pantryItemId', 'quantity', 'servingOption'],
        properties: {
          pantryItemId: { type: 'string', format: 'uuid' },
          quantity: { type: 'number' },
          servingOption: recipeServingOptionBodySchema,
        },
      },
    },
  },
} as const;

function resolveRequestScope(app: FastifyInstance, scope: RequestScope | undefined): RequestScope {
  return scope ?? createRequestScopeForApp(app);
}

function sendSvc(reply: FastifyReply) {
  return reply.status(503).send({ error: 'service_unavailable' });
}

function sendFoodLogListOutcome(reply: FastifyReply, outcome: PublicFoodLogListOutcome) {
  switch (outcome.kind) {
    case 'persistence_not_configured':
    case 'persistence_unavailable':
      return sendSvc(reply);
    case 'ok':
      return reply.status(200).send({ entries: outcome.entries });
    default: {
      const _: never = outcome;
      return _;
    }
  }
}

function sendFoodLogBatchCreateOutcome(reply: FastifyReply, outcome: PublicFoodLogBatchCreateOutcome) {
  switch (outcome.kind) {
    case 'persistence_not_configured':
    case 'persistence_unavailable':
      return sendSvc(reply);
    case 'invalid_input':
      return reply.status(400).send({
        error: 'invalid_input',
        field: outcome.field,
        message: outcome.message,
      });
    case 'ok':
      return reply.status(201).send({ entries: outcome.entries });
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

export async function registerFoodLogRoutes(app: FastifyInstance, requestScope?: RequestScope) {
  const scope = resolveRequestScope(app, requestScope);

  app.get(
    '/food-log/entries',
    {
      schema: {
        summary: 'List Food Log Entries for a local calendar day',
        description:
          'Returns Food Log Entries for the authenticated owner and the given local date (YYYY-MM-DD).',
        querystring: {
          type: 'object',
          required: ['date'],
          properties: {
            date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          },
        },
        response: {
          200: foodLogEntriesListResponse,
          400: badRequestBody,
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
      const date = parseFoodLogLocalDateQuery(q['date']);
      if (date === null) {
        return reply.status(400).send({ error: 'invalid_query' });
      }
      const outcome = await scope.foodLog.listEntriesForOwnerOnLocalDate(ownerUserId, date);
      return sendFoodLogListOutcome(reply, outcome);
    },
  );

  app.post(
    '/food-log/entries/batch',
    {
      schema: {
        summary: 'Create Food Log Entries (batch)',
        description: 'Atomically records one or more Food Log Entries for a single consumed instant.',
        body: foodLogBatchBodySchema,
        response: {
          201: foodLogEntriesListResponse,
          400: {
            type: 'object',
            additionalProperties: false,
            required: ['error'],
            properties: {
              error: { type: 'string', enum: ['invalid_input'] },
              field: { type: 'string' },
              message: { type: 'string' },
            },
          },
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
      const outcome = await scope.foodLog.createEntriesBatchForOwner(ownerUserId, request.body);
      return sendFoodLogBatchCreateOutcome(reply, outcome);
    },
  );
}
