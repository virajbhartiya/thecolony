'use client';
import { create } from 'zustand';
import type { WorldSnapshot } from './api';

export interface AgentLive {
  id: string;
  name: string;
  pos_x: number;
  pos_y: number;
  target_x: number;
  target_y: number;
  state: string;
  status: string;
  occupation: string | null;
  balance_cents: number;
  portrait_seed: string;
  lastBubble?: { text: string; expires: number };
  lastFloater?: { text: string; color: string; expires: number };
}

export interface LiveEvent {
  id: number;
  t: string;
  kind: string;
  actor_ids: string[];
  location_id: string | null;
  importance: number;
  payload: Record<string, unknown>;
}

export interface WorldState {
  width: number;
  height: number;
  buildings: WorldSnapshot['buildings'];
  agents: Map<string, AgentLive>;
  events: LiveEvent[];
  population: number;
  gdp_cents: number;
  government: WorldSnapshot['government'];
  simTime: string;
  connected: boolean;
  selectedAgentId: string | null;
  selectedBuildingId: string | null;
  followAgentId: string | null;
  heatMode: 'none' | 'crime' | 'wealth' | 'mood';
  paused: boolean;
  tourMode: boolean;
  speed: number;
  setConnected: (b: boolean) => void;
  loadSnapshot: (s: WorldSnapshot) => void;
  loadEvents: (events: LiveEvent[]) => void;
  applyEvent: (e: LiveEvent) => void;
  setAgentTarget: (id: string, tx: number, ty: number) => void;
  selectAgent: (id: string | null) => void;
  selectBuilding: (id: string | null) => void;
  toggleFollow: (id: string) => void;
  setHeatMode: (m: 'none' | 'crime' | 'wealth' | 'mood') => void;
  setPaused: (p: boolean) => void;
  setTourMode: (t: boolean) => void;
  setSpeed: (s: number) => void;
}

export const useWorld = create<WorldState>((set, get) => ({
  width: 96,
  height: 96,
  buildings: [],
  agents: new Map(),
  events: [],
  population: 0,
  gdp_cents: 0,
  government: {
    mayor_id: null,
    mayor_name: null,
    treasury_cents: 0,
    tax_rate_bps: 0,
    election_id: null,
    next_election_at: null,
    turnout: null,
  },
  simTime: new Date().toISOString(),
  connected: false,
  selectedAgentId: null,
  selectedBuildingId: null,
  followAgentId: null,
  heatMode: 'none',
  paused: false,
  tourMode: false,
  speed: 1,
  setConnected: (b) => set({ connected: b }),
  setHeatMode: (m) => set({ heatMode: m }),
  setPaused: (p) => set({ paused: p }),
  setTourMode: (t) => set({ tourMode: t }),
  setSpeed: (s) => set({ speed: s }),
  loadSnapshot: (s) => {
    const m = new Map<string, AgentLive>();
    for (const a of s.agents) m.set(a.id, { ...a });
    set({
      width: s.width,
      height: s.height,
      buildings: s.buildings,
      agents: m,
      population: s.population,
      gdp_cents: s.gdp_cents,
      government: s.government,
      simTime: s.sim_time,
    });
  },
  loadEvents: (events) => set({ events: events.slice(0, 200) }),
  applyEvent: (e) => {
    const agents = new Map(get().agents);
    const now = Date.now();
    const bubble = (id: string, text: string) => {
      const a = agents.get(id);
      if (!a) return;
      agents.set(id, { ...a, lastBubble: { text, expires: now + 4500 } });
    };
    const floater = (id: string, text: string, color: string) => {
      const a = agents.get(id);
      if (!a) return;
      agents.set(id, { ...a, lastFloater: { text, color, expires: now + 1800 } });
    };
    switch (e.kind) {
      case 'agent_moved': {
        // target update — actual coords will sync from next snapshot, but we set a hint
        break;
      }
      case 'agent_spoke': {
        const body = (e.payload?.body as string) ?? '...';
        bubble(e.actor_ids[0]!, body.slice(0, 60));
        break;
      }
      case 'agent_paid_wage': {
        const amt = Number(e.payload?.amount_cents ?? 0) / 100;
        floater(e.actor_ids[0]!, `+$${amt.toFixed(0)}`, '#7ee787');
        break;
      }
      case 'agent_paid_rent': {
        const amt = Number(e.payload?.rent ?? 0) / 100;
        floater(e.actor_ids[0]!, `-$${amt.toFixed(0)}`, '#f0883e');
        break;
      }
      case 'city_aid_paid': {
        const amt = Number(e.payload?.amount_cents ?? 0) / 100;
        floater(e.actor_ids[0]!, `+$${amt.toFixed(0)} aid`, '#58a6ff');
        break;
      }
      case 'city_tax_collected':
        for (const id of e.actor_ids.slice(0, 5)) floater(id, 'tax', '#f0c84a');
        break;
      case 'order_placed':
        floater(e.actor_ids[0]!, String(e.payload?.side ?? 'order'), '#f0c84a');
        break;
      case 'trade_executed': {
        const amt = Number(e.payload?.amount_cents ?? 0) / 100;
        floater(e.actor_ids[0]!, `-$${amt.toFixed(0)}`, '#f0883e');
        floater(e.actor_ids[1]!, `+$${amt.toFixed(0)}`, '#7ee787');
        break;
      }
      case 'agent_evicted':
        floater(e.actor_ids[0]!, 'evicted', '#f85149');
        break;
      case 'agent_fired':
        floater(e.actor_ids[0]!, 'fired', '#f85149');
        break;
      case 'agent_commuted':
        floater(e.actor_ids[0]!, 'to work', '#58a6ff');
        break;
      case 'agent_worked':
        floater(e.actor_ids[0]!, 'working', '#7ee787');
        break;
      case 'incident_theft':
        floater(e.actor_ids[0]!, 'theft', '#f85149');
        if (e.actor_ids[1]) floater(e.actor_ids[1], 'robbed', '#f0883e');
        break;
      case 'incident_assault':
        floater(e.actor_ids[0]!, 'assault', '#f85149');
        if (e.actor_ids[1]) floater(e.actor_ids[1], 'hurt', '#f0883e');
        break;
      case 'incident_fraud':
        floater(e.actor_ids[0]!, 'fraud', '#f0c84a');
        if (e.actor_ids[1]) floater(e.actor_ids[1], 'scammed', '#f0883e');
        break;
      case 'incident_breach':
        floater(e.actor_ids[0]!, 'breach', '#f0c84a');
        break;
      case 'agent_accused':
        floater(e.actor_ids[1]!, 'accused', '#f0c84a');
        break;
      case 'agent_jailed':
        floater(e.actor_ids[0]!, 'jailed', '#f85149');
        break;
      case 'bounty_paid': {
        const amt = Number(e.payload?.amount_cents ?? 0) / 100;
        floater(e.actor_ids[0]!, `+$${amt.toFixed(0)} bounty`, '#7ee787');
        break;
      }
      case 'group_founded':
        floater(e.actor_ids[0]!, 'founded group', '#bf8cff');
        break;
      case 'group_joined':
        floater(e.actor_ids[0]!, 'joined group', '#bf8cff');
        break;
      case 'group_left':
        floater(e.actor_ids[0]!, 'left group', '#8b949e');
        break;
      case 'agent_released':
        floater(e.actor_ids[0]!, 'released', '#7ee787');
        break;
      case 'agent_died':
        floater(e.actor_ids[0]!, '✝', '#888');
        break;
      case 'agent_bankrupt':
        floater(e.actor_ids[0]!, 'bankrupt', '#f0c84a');
        break;
      case 'birth':
        floater(e.actor_ids[0]!, 'new citizen', '#7ee787');
        break;
      case 'news_headline':
        for (const id of e.actor_ids.slice(0, 3)) floater(id, 'news', '#58a6ff');
        break;
    }
    const events = [e, ...get().events].slice(0, 200);
    set({ agents, events });
  },
  setAgentTarget: (id, tx, ty) => {
    const agents = new Map(get().agents);
    const a = agents.get(id);
    if (!a) return;
    agents.set(id, { ...a, target_x: tx, target_y: ty });
    set({ agents });
  },
  selectAgent: (id) => set({ selectedAgentId: id, selectedBuildingId: null }),
  selectBuilding: (id) => set({ selectedBuildingId: id, selectedAgentId: null }),
  toggleFollow: (id) => set({ followAgentId: get().followAgentId === id ? null : id }),
}));

export function mergeSnapshotAgents(s: WorldSnapshot) {
  const state = useWorld.getState();
  const agents = new Map(state.agents);
  for (const a of s.agents) {
    const existing = agents.get(a.id);
    agents.set(a.id, {
      ...(existing ?? {}),
      ...a,
      // smooth: keep current pos if we already have one, but always update target
      pos_x: existing?.pos_x ?? a.pos_x,
      pos_y: existing?.pos_y ?? a.pos_y,
    });
  }
  // drop agents that disappeared (e.g., died)
  for (const id of Array.from(agents.keys())) {
    if (!s.agents.find((x) => x.id === id)) agents.delete(id);
  }
  useWorld.setState({
    agents,
    population: s.population,
    gdp_cents: s.gdp_cents,
    government: s.government,
    simTime: s.sim_time,
  });
}
