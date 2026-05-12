export function eventText(kind: string, payload: Record<string, unknown> = {}): string {
  switch (kind) {
    case 'agent_spoke':
      return `said "${String(payload.body ?? '').slice(0, 120)}"`;
    case 'agent_hired':
      return `hired as ${String(payload.role ?? 'worker')} at ${String(payload.company ?? 'a company')}`;
    case 'agent_fired':
      return `fired from ${String(payload.company ?? 'a company')}`;
    case 'job_posted':
      return `${String(payload.company ?? 'A company')} posted ${String(payload.openings ?? '?')} ${String(payload.role ?? 'worker')} opening(s)`;
    case 'agent_paid_wage':
      return `earned $${(Number(payload.amount_cents ?? 0) / 100).toFixed(0)} in wages`;
    case 'agent_paid_rent':
      return `paid $${(Number(payload.rent ?? 0) / 100).toFixed(0)} rent`;
    case 'city_tax_collected':
      return `City Hall collected $${(Number(payload.amount_cents ?? 0) / 100).toFixed(0)} from ${String(payload.taxpayer_count ?? 0)} taxpayers`;
    case 'city_aid_paid':
      return `public aid paid $${(Number(payload.amount_cents ?? 0) / 100).toFixed(0)}`;
    case 'mayor_elected':
      return `${String(payload.mayor_name ?? 'A candidate')} won the mayoral election`;
    case 'company_founded':
      return `${String(payload.name ?? 'A company')} was founded`;
    case 'shares_issued':
      return `${String(payload.ticker ?? payload.company ?? 'A company')} issued ${String(payload.shares ?? '?')} shares`;
    case 'order_placed':
      return `${String(payload.side ?? 'order')} ${String(payload.ticker ?? payload.asset ?? 'shares')} at $${(Number(payload.price_cents ?? 0) / 100).toFixed(2)}`;
    case 'trade_executed':
      return `${String(payload.ticker ?? payload.asset ?? 'shares')} traded ${String(payload.qty ?? '?')} shares at $${(Number(payload.price_cents ?? 0) / 100).toFixed(2)}`;
    case 'incident_theft':
      return `theft of $${(Number(payload.amount_cents ?? 0) / 100).toFixed(0)} reported`;
    case 'incident_assault':
      return `assault reported, severity ${String(payload.severity ?? '?')}`;
    case 'incident_fraud':
      return `fraud of $${(Number(payload.amount_cents ?? 0) / 100).toFixed(0)} reported`;
    case 'incident_breach':
      return `contract breach worth $${(Number(payload.amount_cents ?? 0) / 100).toFixed(0)} reported`;
    case 'incident_witnessed':
      return `witnessed ${String(payload.charge ?? 'an incident')}`;
    case 'agent_accused':
      return `accused someone of ${String(payload.charge ?? 'a crime')}`;
    case 'court_verdict':
      return `${payload.guilty ? 'guilty' : 'not guilty'} verdict for ${String(payload.charge ?? 'case')}`;
    case 'bounty_paid':
      return `bounty paid: $${(Number(payload.amount_cents ?? 0) / 100).toFixed(0)}`;
    case 'agent_jailed':
      return `jailed for ${String(payload.charge ?? 'a case')}`;
    case 'agent_released':
      return `released on parole`;
    case 'group_founded':
      return `${String(payload.name ?? 'A group')} was founded as a ${String(payload.kind ?? 'group')}`;
    case 'group_joined':
      return `joined ${String(payload.name ?? 'a group')}`;
    case 'group_left':
      return `left ${String(payload.name ?? 'a group')}`;
    case 'birth':
      return `${String(payload.name ?? 'A new citizen')} entered civic life`;
    case 'agent_bankrupt':
      return `declared bankrupt`;
    case 'agent_died':
      return `died from ${String(payload.cause ?? 'unknown causes')}`;
    default:
      return kind.replaceAll('_', ' ');
  }
}
