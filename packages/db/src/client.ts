import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@thecolony/config';
import * as schema from './schema';

const client = postgres(env().DATABASE_URL, {
  max: 20,
  prepare: false,
});

export const db = drizzle(client, { schema });
export type Database = typeof db;
export { schema };
export const rawClient = client;
