'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { fetchSnapshot } from '../lib/api';
import { mergeSnapshotAgents, useWorld } from '../lib/store';
import { useWorldStream } from '../lib/ws';
import HUD from '../components/HUD';
import EventTicker from '../components/EventTicker';
import AgentDrawer from '../components/AgentDrawer';
import BuildingDrawer from '../components/BuildingDrawer';

const CityCanvas = dynamic(() => import('../components/CityCanvas'), { ssr: false });

export default function Home() {
  const loadSnapshot = useWorld((s) => s.loadSnapshot);
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
  }, [loadSnapshot, bootstrapped]);

  return (
    <main className="relative w-screen h-screen overflow-hidden">
      <CityCanvas className="absolute inset-0" />
      <HUD />
      <EventTicker />
      <AgentDrawer />
      <BuildingDrawer />
      {error && !bootstrapped && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="glass rounded-lg p-6 max-w-md text-center">
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
