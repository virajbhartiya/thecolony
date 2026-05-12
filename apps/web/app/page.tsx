'use client';
import { useEffect, useState } from 'react';
import { fetchEvents, fetchSnapshot } from '../lib/api';
import { mergeSnapshotAgents, useWorld } from '../lib/store';
import { useWorldStream } from '../lib/ws';
import CityCanvas from '../components/CityCanvas';
import HUD from '../components/HUD';
import EventTicker from '../components/EventTicker';
import BottomBar from '../components/BottomBar';
import AgentDrawer from '../components/AgentDrawer';
import BuildingDrawer from '../components/BuildingDrawer';
import LeftSidebar from '../components/LeftSidebar';
import StockTicker from '../components/StockTicker';
import HeadlineBanner from '../components/HeadlineBanner';
import WantedPanel from '../components/WantedPanel';
import SideRail from '../components/SideRail';

export default function Home() {
  const loadSnapshot = useWorld((s) => s.loadSnapshot);
  const loadEvents = useWorld((s) => s.loadEvents);
  const selectedAgentId = useWorld((s) => s.selectedAgentId);
  const selectedBuildingId = useWorld((s) => s.selectedBuildingId);
  const tourMode = useWorld((s) => s.tourMode);
  const events = useWorld((s) => s.events);
  const selectAgent = useWorld((s) => s.selectAgent);
  const selectBuilding = useWorld((s) => s.selectBuilding);
  const [error, setError] = useState<string | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  useWorldStream();

  // The live view is a fullscreen fixed canvas — lock the body scroll while
  // we're on /, restore it on unmount so /feed /market /news scroll normally.
  useEffect(() => {
    document.body.classList.add('live-fullscreen');
    return () => document.body.classList.remove('live-fullscreen');
  }, []);

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

  // Tour mode — every 8s, jump selection to the most important recent event.
  useEffect(() => {
    if (!tourMode) return;
    const id = setInterval(() => {
      const hot = events.find((e) => e.importance >= 6);
      if (!hot) return;
      if (hot.actor_ids[0]) selectAgent(hot.actor_ids[0]);
      else if (hot.location_id) selectBuilding(hot.location_id);
    }, 8000);
    return () => clearInterval(id);
  }, [tourMode, events, selectAgent, selectBuilding]);

  return (
    <main style={{ position: 'fixed', inset: 0, background: '#0b0a10', overflow: 'hidden' }}>
      <CityCanvas />
      <div className="scanlines" />
      <StockTicker />
      <HUD />
      <SideRail />
      <LeftSidebar />
      <WantedPanel />
      <EventTicker />
      <BottomBar />
      <HeadlineBanner />
      {selectedAgentId && <AgentDrawer />}
      {selectedBuildingId && <BuildingDrawer />}

      <div
        className="mono"
        style={{
          position: 'absolute',
          left: 16,
          bottom: 80,
          fontSize: 10,
          color: '#5e5868',
          background: 'rgba(11,10,16,0.7)',
          border: '1px solid #2a2236',
          padding: '4px 8px',
          zIndex: 15,
        }}
      >
        DRAG · pan &nbsp; SCROLL · zoom &nbsp; CLICK · dossier &nbsp; F · follow
      </div>

      {error && !bootstrapped && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'grid', placeItems: 'center' }}>
          <div className="panel" style={{ padding: '20px 24px', maxWidth: 420, textAlign: 'center' }}>
            <div className="panel-title" style={{ marginBottom: 8 }}>
              Can't reach the city.
            </div>
            <p style={{ fontSize: 12, color: '#cdb98a' }}>
              API:{' '}
              <code className="mono" style={{ color: '#ffc26b' }}>
                {process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4001'}
              </code>
            </p>
            <p className="mono" style={{ fontSize: 10, color: '#5e5868', marginTop: 8 }}>
              {error}
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
