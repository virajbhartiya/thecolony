import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { env, hasLLMKey } from '@thecolony/config';
import type { Agent } from '@thecolony/domain';
import { canCallLLM, recordCall } from './rate-limit';

export async function synthesizeDoctrine({
  agent,
  name,
  kind,
}: {
  agent: Agent;
  name: string;
  kind: 'cult' | 'party' | 'union' | 'club';
}): Promise<string> {
  const fallback = fallbackDoctrine(agent, kind);
  if (!hasLLMKey() || !canCallLLM()) return fallback;

  try {
    recordCall();
    const e = env();
    const { text } = await generateText({
      model: doctrineModel(e),
      temperature: 0.85,
      maxRetries: 1,
      prompt: [
        `Write a faction doctrine for a persistent AI city simulation.`,
        `Return only one compact manifesto paragraph, 35-70 words. No markdown.`,
        `Founder: ${agent.name}, ${agent.occupation ?? 'unemployed'}.`,
        `Traits: ambition=${agent.traits.ambition.toFixed(2)}, empathy=${agent.traits.empathy.toFixed(2)}, greed=${agent.traits.greed.toFixed(2)}, paranoia=${agent.traits.paranoia.toFixed(2)}, ideology=${agent.traits.ideology_lean.toFixed(2)}.`,
        `Faction: ${name}, kind=${kind}.`,
      ].join('\n'),
    });
    const cleaned = text.replace(/\s+/g, ' ').trim();
    return cleaned.length >= 20 ? cleaned.slice(0, 800) : fallback;
  } catch (e) {
    console.warn('[llm] doctrine fell back to deterministic text:', (e as Error).message.slice(0, 160));
    return fallback;
  }
}

function doctrineModel(e = env()) {
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

function fallbackDoctrine(agent: Agent, kind: 'cult' | 'party' | 'union' | 'club'): string {
  const first = agent.name.split(' ')[0] ?? agent.name;
  if (kind === 'union') {
    return `${first}'s union believes the city owes dignity to workers: steady wages, safe shops, fair rents, and no silent firings when owners panic. Members share job leads and punish bosses who exploit hunger.`;
  }
  if (kind === 'party') {
    return `${first}'s party wants City Hall to serve visible results: lower waste, honest taxes, food security, and public order. Members vote as a bloc and judge leaders by rents, safety, and work.`;
  }
  if (kind === 'cult') {
    return `${first}'s circle believes the city hides patterns in hunger, money, and chance. Members watch signs, protect insiders, distrust outsiders, and treat every public event as a message to decode.`;
  }
  return `${first}'s club exists for mutual advantage: introductions, shared rumors, emergency meals, and small loans between people who want more from the city than survival.`;
}
