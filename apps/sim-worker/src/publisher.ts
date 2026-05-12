import Redis from 'ioredis';
import { env } from '@thecolony/config';
import { log } from './log';

const pub = new Redis(env().REDIS_URL);

export async function publish(event: object): Promise<void> {
  try {
    await pub.publish('world.events', JSON.stringify(event));
  } catch (e) {
    log.warn({ err: (e as Error).message }, 'publish failed');
  }
}

export async function closePublisher() {
  await pub.quit();
}
