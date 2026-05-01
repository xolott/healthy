import Fastify from 'fastify';

import { registerEnv } from './config/env.js';
import { registerCors } from './plugins/cors.js';
import { registerSensible } from './plugins/sensible.js';
import { registerSwagger } from './plugins/swagger.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerFirstOwnerSetupRoute } from './routes/first-owner-setup.js';
import { registerAuthLogoutRoute } from './routes/auth-logout.js';
import { registerAuthMeRoute } from './routes/auth-me.js';
import { registerOwnerLoginRoute } from './routes/owner-login.js';
import { registerFoodLogRoutes } from './routes/food-log.js';
import { registerPantryRoutes } from './routes/pantry.js';
import { registerReferenceFoodRoutes } from './routes/reference-foods.js';
import type { RequestScope } from './request-scope/index.js';
import { registerStatusRoutes } from './routes/status.js';
import { summarizeLogger } from './utils/logger.js';

export type BuildAppOptions = {
  /** Test-only override; production uses `createRequestScopeForApp(app)`. */
  requestScope?: RequestScope;
};

export async function buildApp(options?: BuildAppOptions) {
  const app = Fastify({ logger: true });

  await registerEnv(app);
  await registerCors(app);
  await registerSensible(app);
  await registerSwagger(app);
  await registerHealthRoutes(app);
  await registerStatusRoutes(app, options?.requestScope);
  await registerFirstOwnerSetupRoute(app, options?.requestScope);
  await registerOwnerLoginRoute(app, options?.requestScope);
  await registerAuthMeRoute(app, options?.requestScope);
  await registerPantryRoutes(app, options?.requestScope);
  await registerReferenceFoodRoutes(app, options?.requestScope);
  await registerFoodLogRoutes(app, options?.requestScope);
  await registerAuthLogoutRoute(app, options?.requestScope);

  summarizeLogger(app.log);

  return app;
}
