import Fastify from 'fastify';

import { registerEnv } from './config/env.js';
import { registerCors } from './plugins/cors.js';
import { registerSensible } from './plugins/sensible.js';
import { registerSwagger } from './plugins/swagger.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerFirstOwnerSetupRoute, type FirstOwnerRouteOptions } from './routes/first-owner-setup.js';
import { registerAuthLogoutRoute } from './routes/auth-logout.js';
import { registerAuthMeRoute } from './routes/auth-me.js';
import { registerOwnerLoginRoute, type OwnerLoginRouteOptions } from './routes/owner-login.js';
import type { RequestScope } from './request-scope/index.js';
import { registerStatusRoutes } from './routes/status.js';
import { summarizeLogger } from './utils/logger.js';

export type BuildAppOptions = {
  /** Test-only override; production uses `createRequestScopeForApp(app)`. */
  requestScope?: RequestScope;
  firstOwnerRouteOptions?: FirstOwnerRouteOptions;
  ownerLoginRouteOptions?: OwnerLoginRouteOptions;
};

export async function buildApp(options?: BuildAppOptions) {
  const app = Fastify({ logger: true });

  await registerEnv(app);
  await registerCors(app);
  await registerSensible(app);
  await registerSwagger(app);
  await registerHealthRoutes(app);
  await registerStatusRoutes(app, options?.requestScope);
  await registerFirstOwnerSetupRoute(app, options?.firstOwnerRouteOptions);
  await registerOwnerLoginRoute(app, options?.ownerLoginRouteOptions);
  await registerAuthMeRoute(app, options?.requestScope);
  await registerAuthLogoutRoute(app, options?.requestScope);

  summarizeLogger(app.log);

  return app;
}
