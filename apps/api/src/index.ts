import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { env } from '@thecolony/config';
import { registerWorldRoutes } from './routes/world';
import { registerAgentRoutes } from './routes/agent';
import { registerEventRoutes } from './routes/events';
import { registerCityRoutes } from './routes/city';
import { registerWsRoutes } from './routes/ws';

async function main() {
  const app = Fastify({
    logger: { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss.l' } } },
  });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  app.get('/v1/health', async () => ({ ok: true, t: new Date().toISOString() }));

  await registerWorldRoutes(app);
  await registerAgentRoutes(app);
  await registerEventRoutes(app);
  await registerCityRoutes(app);
  await registerWsRoutes(app);

  const e = env();
  await app.listen({ host: e.API_HOST, port: e.API_PORT });
  app.log.info(`API listening on http://${e.API_HOST}:${e.API_PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
