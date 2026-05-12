import type { FastifyInstance } from 'fastify';
import Redis from 'ioredis';
import { env } from '@thecolony/config';

export async function registerWsRoutes(app: FastifyInstance) {
  const subscriber = new Redis(env().REDIS_URL);
  await subscriber.subscribe('world.events');

  const clients = new Set<{ send: (msg: string) => void }>();
  subscriber.on('message', (_channel, payload) => {
    for (const c of clients) {
      try {
        c.send(payload);
      } catch {
        // best effort
      }
    }
  });

  app.get('/v1/events/stream', { websocket: true }, (socket) => {
    const ref = { send: (msg: string) => socket.send(msg) };
    clients.add(ref);
    socket.send(JSON.stringify({ kind: 'hello', t: new Date().toISOString() }));
    socket.on('close', () => clients.delete(ref));
    socket.on('error', () => clients.delete(ref));
  });

  app.addHook('onClose', async () => {
    await subscriber.quit();
  });
}
