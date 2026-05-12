'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { fetchEvents, fetchSnapshot } from '../lib/api';
import { mergeSnapshotAgents, useWorld } from '../lib/store';
import { useWorldStream } from '../lib/ws';
import HUD from '../components/HUD';
import EventTicker from '../components/EventTicker';

const CityCanvas = dynamic(() => import('../components/CityCanvas'), {
  loading: () => <CityLoading />,
});
const AgentDrawer = dynamic(() => import('../components/AgentDrawer'));
const BuildingDrawer = dynamic(() => import('../components/BuildingDrawer'));

export default function Home() {
  const loadSnapshot = useWorld((s) => s.loadSnapshot);
  const loadEvents = useWorld((s) => s.loadEvents);
  const selectedAgentId = useWorld((s) => s.selectedAgentId);
  const selectedBuildingId = useWorld((s) => s.selectedBuildingId);
  const [error, setError] = useState<string | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  useWorldStream();

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    const tick = async () => {
      try {
        const snap = await fetchSnapshot();
        if (stopped) return;
        if (!bootstrapped) {
          loadSnapshot(snap);
          const history = await fetchEvents().catch(() => ({ events: [] }));
          if (!stopped) loadEvents(history.events ?? []);
          setBootstrapped(true);
        } else {
          mergeSnapshotAgents(snap);
        }
        setError(null);
      } catch (e) {
        if (!stopped) setError((e as Error).message);
      } finally {
        if (!stopped) timer = window.setTimeout(tick, 1500);
      }
    };
    tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [loadSnapshot, loadEvents, bootstrapped]);

  return (
    <main className="relative w-screen h-screen overflow-hidden">
      <CityCanvas className="absolute inset-0" />
      <div className="scanlines" />
      <HUD />
      <EventTicker />
      {selectedAgentId && <AgentDrawer />}
      {selectedBuildingId && <BuildingDrawer />}
      {error && !bootstrapped && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="panel p-6 max-w-md text-center">
            <h2 className="text-lg font-medium mb-2">Can't reach the city.</h2>
            <p className="text-sm text-zinc-400">
              The API is at <code className="text-zinc-200">{process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'}</code>.<br />
              Check that <code className="text-zinc-200">docker compose up</code> and{' '}
              <code className="text-zinc-200">pnpm dev</code> are running.
            </p>
            <p className="text-xs text-zinc-500 mt-3">{error}</p>
          </div>
        </div>
      )}
    </main>
  );
}

function CityLoading() {
  return (
    <div className="city-loading absolute inset-0 grid place-items-center">
      <div className="panel px-5 py-4 text-center">
        <div className="panel-title">TheColony</div>
        <div className="mt-2 text-xs text-[var(--mute)]">loading city renderer</div>
      </div>
    </div>
  );
}
