import Fastify from 'fastify';

import { registerEnv } from './config/env.js';
import { registerCors } from './plugins/cors.js';
import { registerSensible } from './plugins/sensible.js';
import { registerSwagger } from './plugins/swagger.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerFirstOwnerSetupRoute, type FirstOwnerRouteOptions } from './routes/first-owner-setup.js';
import { registerAuthMeRoute, type AuthMeRouteOptions } from './routes/auth-me.js';
import { registerOwnerLoginRoute, type OwnerLoginRouteOptions } from './routes/owner-login.js';
import { registerStatusRoutes, type StatusRouteDeps } from './routes/status.js';
import { summarizeLogger } from './utils/logger.js';

export type BuildAppOptions = {
  statusRouteDeps?: StatusRouteDeps;
  firstOwnerRouteOptions?: FirstOwnerRouteOptions;
  ownerLoginRouteOptions?: OwnerLoginRouteOptions;
  authMeRouteOptions?: AuthMeRouteOptions;
};

export async function buildApp(options?: BuildAppOptions) {
  const app = Fastify({ logger: true });

  await registerEnv(app);
  await registerCors(app);
  await registerSensible(app);
  await registerSwagger(app);
  await registerHealthRoutes(app);
  await registerStatusRoutes(app, options?.statusRouteDeps);
  await registerFirstOwnerSetupRoute(app, options?.firstOwnerRouteOptions);
  await registerOwnerLoginRoute(app, options?.ownerLoginRouteOptions);
  await registerAuthMeRoute(app, options?.authMeRouteOptions);

  summarizeLogger(app.log);

  return app;
}
