import { buildApp } from './app.js';

const app = await buildApp();

function readPort(port: string): number {
  const parsed = Number.parseInt(port, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3001;
}

await app.listen({
  host: app.config.HOST ?? '0.0.0.0',
  port: readPort(app.config.PORT),
});
