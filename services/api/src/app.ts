import Fastify from 'fastify';

import { registerEnv } from './config/env.js';
import { registerCors } from './plugins/cors.js';
import { registerSensible } from './plugins/sensible.js';
import { registerSwagger } from './plugins/swagger.js';
import { registerHealthRoutes } from './routes/health.js';
import { summarizeLogger } from './utils/logger.js';

export async function buildApp() {
  const app = Fastify({ logger: true });

  await registerEnv(app);
  await registerCors(app);
  await registerSensible(app);
  await registerSwagger(app);
  await registerHealthRoutes(app);

  summarizeLogger(app.log);

  return app;
}
