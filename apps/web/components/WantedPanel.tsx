'use client';
import { useEffect, useState } from 'react';
import { useWorld } from '../lib/store';
import { fetchEndpoint } from '../lib/api';

interface Crook {
  id: string;
  name: string;
  occupation: string | null;
  incidents: number;
  severity: number;
}

interface CrimeResp {
  topCriminals?: Crook[];
}

export default function WantedPanel() {
  const visible = useWorld((s) => s.showWanted);
  const toggleWanted = useWorld((s) => s.toggleWanted);
  const select = useWorld((s) => s.selectAgent);
  const [list, setList] = useState<Crook[]>([]);

  useEffect(() => {
    let stopped = false;
    const tick = () =>
      fetchEndpoint<CrimeResp>('/v1/crime')
        .then((r) => !stopped && setList(r.topCriminals ?? []))
        .catch(() => {});
    tick();
    const id = setInterval(tick, 12_000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, []);

  if (!visible || list.length === 0) return null;

  return (
    <div
      className="panel"
      style={{
        position: 'absolute',
        top: 78,
        left: 60,
        width: 280,
        padding: '0',
        zIndex: 19,
      }}
    >
      <div className="panel-header" style={{ borderColor: 'rgba(226,83,110,0.4)', background: 'linear-gradient(180deg, rgba(226,83,110,0.12), transparent)' }}>
        <span className="panel-title" style={{ color: '#e2536e' }}>▌ MOST WANTED</span>
        <button className="iconbtn" onClick={toggleWanted} style={{ width: 18, height: 18, fontSize: 9 }}>×</button>
      </div>
      <div>
        {list.slice(0, 5).map((c, i) => (
          <button
            key={c.id}
            onClick={() => select(c.id)}
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto',
              gap: 8,
              width: '100%',
              padding: '6px 10px',
              border: 'none',
              borderBottom: '1px dashed #2a2236',
              background: 'transparent',
              color: '#ece6d3',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span className="pixel" style={{ fontSize: 9, color: '#e2536e', letterSpacing: '0.18em' }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.name}
              </div>
              <div className="mono" style={{ fontSize: 9, color: '#8a8478' }}>
                {c.occupation ?? '—'}
              </div>
            </span>
            <span className="mono" style={{ fontSize: 10, color: '#e2536e', textAlign: 'right' }}>
              {c.incidents}× · sev {c.severity}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
