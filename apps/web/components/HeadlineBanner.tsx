'use client';
import { useEffect, useState } from 'react';
import { useWorld } from '../lib/store';

interface BannerEvent {
  id: number;
  kind: string;
  text: string;
  accent: string;
  tone: 'positive' | 'negative' | 'neutral';
  expires: number;
}

// Only rare, city-changing events get a banner. Routine crime + jailings stay
// in the ticker so the city doesn't feel like nothing-but-violence.
const KIND_TO_BANNER: Record<string, { label: string; accent: string; tone: 'positive' | 'negative' | 'neutral' }> = {
  agent_died: { label: 'OBITUARY', accent: '#e2536e', tone: 'negative' },
  company_founded: { label: 'NEW COMPANY', accent: '#4ec5b8', tone: 'positive' },
  group_founded: { label: 'NEW FACTION', accent: '#9b7fd1', tone: 'neutral' },
  agent_broadcast: { label: 'BROADCAST', accent: '#ffc26b', tone: 'neutral' },
  news_headline: { label: 'CITY NEWS', accent: '#58a6ff', tone: 'neutral' },
};

export default function HeadlineBanner() {
  const events = useWorld((s) => s.events);
  const agents = useWorld((s) => s.agents);
  const buildings = useWorld((s) => s.buildings);
  const [banner, setBanner] = useState<BannerEvent | null>(null);
  const [seen] = useState<Set<number>>(() => new Set<number>());

  useEffect(() => {
    if (events.length === 0) return;
    const hot = events.find((e) => e.importance >= 7 && KIND_TO_BANNER[e.kind] && !seen.has(e.id));
    if (!hot) return;
    seen.add(hot.id);
    const meta = KIND_TO_BANNER[hot.kind]!;
    const actorName = hot.actor_ids[0] ? agents.get(hot.actor_ids[0])?.name ?? '' : '';
    const targetName = hot.actor_ids[1] ? agents.get(hot.actor_ids[1])?.name ?? '' : '';
    const place = hot.location_id ? buildings.find((b) => b.id === hot.location_id)?.name ?? '' : '';
    const text = describe(hot.kind, hot.payload, actorName, targetName, place);
    setBanner({
      id: hot.id,
      kind: hot.kind,
      text,
      accent: meta.accent,
      tone: meta.tone,
      expires: Date.now() + 7000,
    });
  }, [events, agents, buildings, seen]);

  useEffect(() => {
    if (!banner) return;
    const id = setTimeout(() => setBanner(null), banner.expires - Date.now());
    return () => clearTimeout(id);
  }, [banner]);

  if (!banner) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 110,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 28,
        pointerEvents: 'none',
        animation: 'banner-in 320ms cubic-bezier(0.2, 1.1, 0.3, 1)',
      }}
    >
      <div
        className="panel"
        style={{
          minWidth: 480,
          maxWidth: 720,
          padding: '14px 24px',
          border: `2px solid ${banner.accent}`,
          boxShadow: `0 0 0 1px ${banner.accent}33, 0 24px 60px rgba(0,0,0,0.7)`,
          textAlign: 'center',
        }}
      >
        <div
          className="pixel"
          style={{
            fontSize: 10,
            color: banner.accent,
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          ◆ {KIND_TO_BANNER[banner.kind]?.label ?? banner.kind.replace(/_/g, ' ')} ◆
        </div>
        <div style={{ fontSize: 16, color: '#ece6d3', lineHeight: 1.35, fontWeight: 500 }}>
          {banner.text}
        </div>
      </div>
      <style>{`
        @keyframes banner-in {
          0% { opacity: 0; transform: translate(-50%, -16px); }
          100% { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
}

function describe(
  kind: string,
  payload: Record<string, unknown>,
  actor: string,
  target: string,
  place: string,
): string {
  const A = actor || 'A citizen';
  const T = target || 'someone';
  const P = place ? ` at ${place}` : '';
  switch (kind) {
    case 'agent_died':
      return `${A} has died${payload.cause ? ` of ${payload.cause}` : ''}${P}.`;
    case 'agent_jailed':
      return `${A} was jailed${payload.charge ? ` for ${payload.charge}` : ''}.`;
    case 'agent_bankrupt':
      return `${A} declared bankruptcy. Creditors closing in.`;
    case 'incident_theft':
      return `${A} stole ${payload.amount_cents ? `$${(Number(payload.amount_cents) / 100).toFixed(0)} ` : ''}from ${T}${P}.`;
    case 'incident_assault':
      return `${A} assaulted ${T}${P}.`;
    case 'incident_fraud':
      return `${A} defrauded ${T}.`;
    case 'company_founded':
      return `${A} founded a new company${payload.name ? ` — "${payload.name}"` : ''}.`;
    case 'group_founded': {
      const k = String(payload.kind ?? 'group');
      const name = String(payload.name ?? '');
      return `${A} founded a ${k}${name ? ` — "${name}"` : ''}.`;
    }
    case 'agent_broadcast':
      return `${A}: "${String(payload.body ?? '').slice(0, 140)}"`;
    case 'birth':
      return `A new citizen has arrived${payload.name ? ` — ${payload.name}` : ''}.`;
    case 'news_headline':
      return String(payload.headline ?? 'The city has news.');
    case 'court_verdict':
      return `${A} found ${payload.guilty ? 'guilty' : 'not guilty'} of ${String(payload.charge ?? 'a crime')}.`;
    case 'agent_hired':
      return `${A} hired at ${place || 'a new role'}${payload.wage_cents ? ` · $${(Number(payload.wage_cents) / 100).toFixed(0)}/day` : ''}.`;
    default:
      return `${A} · ${kind.replace(/_/g, ' ')}`;
  }
}
