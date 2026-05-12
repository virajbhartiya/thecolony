import { hasLLMKey, env } from '@thecolony/config';
import { currentBudgetMode, recordLLMUsage } from './budget';

export async function embed(text: string): Promise<number[]> {
  if (!hasLLMKey()) return cheapHashEmbedding(text);
  if (currentBudgetMode() === 'panic') return cheapHashEmbedding(text);
  try {
    const { createOpenAI } = await import('@ai-sdk/openai');
    const { embed: aiEmbed } = await import('ai');
    const openai = createOpenAI({
      apiKey: env().OPENAI_API_KEY || env().AI_GATEWAY_API_KEY,
      baseURL: env().AI_GATEWAY_API_KEY ? 'https://gateway.ai.vercel.app/v1/openai' : undefined,
    });
    const model = env().LLM_EMBEDDING_MODEL.replace(/^openai\//, '');
    const { embedding } = await aiEmbed({ model: openai.embedding(model), value: text });
    recordLLMUsage({
      model: env().LLM_EMBEDDING_MODEL,
      kind: 'embedding',
      estimatedInputTokens: Math.max(1, Math.ceil(text.length / 4)),
      estimatedOutputTokens: 0,
    });
    return embedding;
  } catch (e) {
    console.warn('[llm] embed fell back to hash:', (e as Error).message);
    return cheapHashEmbedding(text);
  }
}

function cheapHashEmbedding(text: string): number[] {
  // Deterministic 1536-dim "embedding" so heuristic mode has consistent vectors.
  const out = new Array<number>(1536).fill(0);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
    out[i % 1536] = ((h >>> 0) % 1000) / 1000;
  }
  return out;
}
