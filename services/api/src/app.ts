import Fastify from 'fastify';

import { registerEnv } from './config/env.js';
import { registerCors } from './plugins/cors.js';
import { registerSensible } from './plugins/sensible.js';
import { registerSwagger } from './plugins/swagger.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerStatusRoutes, type StatusRouteDeps } from './routes/status.js';
import { summarizeLogger } from './utils/logger.js';

export type BuildAppOptions = {
  statusRouteDeps?: StatusRouteDeps;
};

export async function buildApp(options?: BuildAppOptions) {
  const app = Fastify({ logger: true });

  await registerEnv(app);
  await registerCors(app);
  await registerSensible(app);
  await registerSwagger(app);
  await registerHealthRoutes(app);
  await registerStatusRoutes(app, options?.statusRouteDeps);

  summarizeLogger(app.log);

  return app;
}
