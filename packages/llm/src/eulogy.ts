import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { env, hasLLMKey } from '@thecolony/config';
import { canCallLLM, recordCall } from './rate-limit';

export async function synthesizeEulogy({
  name,
  occupation,
  cause,
  memories,
  events,
}: {
  name: string;
  occupation: string | null;
  cause: string;
  memories: string[];
  events: string[];
}): Promise<string> {
  const fallback = fallbackEulogy(name, occupation, cause, memories, events);
  if (!hasLLMKey() || !canCallLLM()) return fallback;

  try {
    recordCall();
    const e = env();
    const { text } = await generateText({
      model: eulogyModel(e),
      temperature: 0.75,
      maxRetries: 1,
      prompt: [
        `Write a 4-6 sentence obituary for a citizen in an AI-run city simulation.`,
        `Plain, specific, slightly literary, no markdown.`,
        `Name: ${name}. Occupation: ${occupation ?? 'unassigned'}. Cause of death: ${cause}.`,
        `Memories: ${memories.slice(0, 5).join(' | ') || 'none recorded'}.`,
        `Recent events: ${events.slice(0, 8).join(', ') || 'none recorded'}.`,
      ].join('\n'),
    });
    const cleaned = text.replace(/\s+/g, ' ').trim();
    return cleaned.length >= 80 ? cleaned.slice(0, 1200) : fallback;
  } catch (e) {
    console.warn('[llm] eulogy fell back to deterministic text:', (e as Error).message.slice(0, 160));
    return fallback;
  }
}

function eulogyModel(e = env()) {
  const [provider, ...rest] = e.LLM_MODEL_ESCALATION.split('/');
  const model = rest.join('/');
  if ((provider === 'google' || provider === 'gemini') && (e.GEMINI_API_KEY || e.GOOGLE_GENERATIVE_AI_API_KEY)) {
    return createGoogleGenerativeAI({ apiKey: e.GEMINI_API_KEY || e.GOOGLE_GENERATIVE_AI_API_KEY })(model || e.LLM_MODEL_GEMINI.replace(/^google\//, ''));
  }
  if ((e.OPENAI_API_KEY || e.AI_GATEWAY_API_KEY) && model) {
    return createOpenAI({
      apiKey: e.OPENAI_API_KEY || e.AI_GATEWAY_API_KEY,
      baseURL: e.AI_GATEWAY_API_KEY ? 'https://gateway.ai.vercel.app/v1/openai' : undefined,
    })(model);
  }
  return createGoogleGenerativeAI({ apiKey: e.GEMINI_API_KEY || e.GOOGLE_GENERATIVE_AI_API_KEY })(e.LLM_MODEL_GEMINI.replace(/^google\//, ''));
}

function fallbackEulogy(name: string, occupation: string | null, cause: string, memories: string[], events: string[]): string {
  const work = occupation ? `worked as a ${occupation.toLowerCase()}` : 'never settled into a fixed trade';
  const remembered = memories[0] ?? events[0] ?? 'left only a thin record in the city ledger';
  return `${name} ${work}, moving through the same streets as everyone else while trying to keep hunger, rent, and worry at bay. They died from ${cause}, and the city recorded it without ceremony. People who knew them would remember that ${remembered}. Their account remains in the archive, one more life folded into the history of TheColony.`;
}
