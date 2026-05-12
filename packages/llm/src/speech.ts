import type { Agent } from '@thecolony/domain';

export function speakingTone(agent: Agent): string {
  const t = agent.traits;
  if (t.paranoia > 0.6) return 'paranoid';
  if (t.empathy > 0.6) return 'warm';
  if (t.greed > 0.6) return 'transactional';
  if (t.neuroticism > 0.7) return 'anxious';
  return 'plain';
}

export function synthesizeSpeech(agent: Agent, intent: string): string {
  const tone = speakingTone(agent);
  switch (tone) {
    case 'paranoid':
      return `I’m watching. ${intent}`;
    case 'warm':
      return `Friend — ${intent}`;
    case 'transactional':
      return `Listen. ${intent}. What’s in it for me?`;
    case 'anxious':
      return `I don’t know. ${intent}. Do I?`;
    default:
      return intent;
  }
}
