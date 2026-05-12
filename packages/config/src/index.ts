import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

function findEnvUp(start: string = process.cwd()): string | null {
  let dir = start;
  while (true) {
    const p = resolve(dir, '.env');
    if (existsSync(p)) return p;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const envPath = findEnvUp();
if (envPath) loadDotenv({ path: envPath });
else loadDotenv();

const EnvSchema = z.object({
  DATABASE_URL: z.string().url().default('postgres://colony:colony@localhost:5432/colony'),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  AI_GATEWAY_API_KEY: z.string().optional().default(''),
  OPENAI_API_KEY: z.string().optional().default(''),

  LLM_MODEL_DEFAULT: z.string().default('openai/gpt-4o-mini'),
  LLM_MODEL_ESCALATION: z.string().default('openai/gpt-4o'),
  LLM_EMBEDDING_MODEL: z.string().default('openai/text-embedding-3-small'),

  WORLD_SPEED: z.coerce.number().default(1),
  WORLD_TICK_MS: z.coerce.number().default(1000),
  SIM_AGENT_COUNT: z.coerce.number().int().default(30),
  LLM_HOURLY_USD_CAP: z.coerce.number().default(5),
  LLM_MAX_RPM: z.coerce.number().int().default(2),

  API_PORT: z.coerce.number().default(3001),
  API_HOST: z.string().default('0.0.0.0'),

  NEXT_PUBLIC_API_BASE: z.string().default('http://localhost:3001'),
  NEXT_PUBLIC_WS_URL: z.string().default('ws://localhost:3001/v1/events/stream'),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
    throw new Error('Environment validation failed');
  }
  cached = parsed.data;
  return cached;
}

export function hasLLMKey(): boolean {
  const e = env();
  return Boolean(e.AI_GATEWAY_API_KEY || e.OPENAI_API_KEY);
}
