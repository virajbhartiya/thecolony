import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import { env } from '@thecolony/config';

async function main() {
  const url = env().DATABASE_URL;
  console.log(`[db] connecting to ${url.replace(/:[^:@]+@/, ':***@')}`);
  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  console.log('[db] ensuring extensions');
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
    console.log('[db] pgvector available');
  } catch (e) {
    console.warn('[db] pgvector extension not available — memory embeddings will be inert');
  }

  console.log('[db] running migrations from ./migrations');
  await migrate(db, { migrationsFolder: './migrations' });
  console.log('[db] migrations applied');
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
