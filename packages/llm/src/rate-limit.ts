// Tiny in-process sliding-window rate limiter for LLM calls.
// Keeps a list of recent call timestamps; refuses if we'd exceed limit per minute.

import { env } from '@thecolony/config';
import { currentBudgetMode } from './budget';

const calls: number[] = [];

export function canCallLLM(): boolean {
  if (currentBudgetMode() === 'panic') return false;
  const limit = env().LLM_MAX_RPM;
  if (limit <= 0) return false;
  const now = Date.now();
  const cutoff = now - 60_000;
  while (calls.length > 0 && calls[0]! < cutoff) calls.shift();
  return calls.length < limit;
}

export function recordCall(): void {
  calls.push(Date.now());
}

export function recentCallCount(): number {
  const cutoff = Date.now() - 60_000;
  while (calls.length > 0 && calls[0]! < cutoff) calls.shift();
  return calls.length;
}
