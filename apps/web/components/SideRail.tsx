'use client';
import { useWorld } from '../lib/store';

const W = 40;

export default function SideRail() {
  const showLeft = useWorld((s) => s.showLeftPanel);
  const showWanted = useWorld((s) => s.showWanted);
  const showRight = useWorld((s) => s.showRightPanel);
  const toggleLeft = useWorld((s) => s.toggleLeft);
  const toggleWanted = useWorld((s) => s.toggleWanted);
  const toggleRight = useWorld((s) => s.toggleRight);
  const heatMode = useWorld((s) => s.heatMode);
  const setHeatMode = useWorld((s) => s.setHeatMode);

  return (
    <div
      className="panel"
      style={{
        position: 'absolute',
        top: 78,
        left: 12,
        width: W,
        padding: '6px 4px',
        zIndex: 21,
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        alignItems: 'center',
      }}
    >
      <Rail label="GOV" active={showLeft} onClick={toggleLeft} tone="#ffc26b" />
      <Rail label="JAIL" active={showWanted} onClick={toggleWanted} tone="#e2536e" />
      <Rail label="LIVE" active={showRight} onClick={toggleRight} tone="#4ec5b8" />
      <div style={{ height: 1, background: '#2a2236', alignSelf: 'stretch', margin: '4px 0' }} />
      <Rail label="≡" active={heatMode === 'none'} onClick={() => setHeatMode('none')} tone="#8a8478" hint="no overlay" />
      <Rail label="CRM" active={heatMode === 'crime'} onClick={() => setHeatMode('crime')} tone="#e2536e" hint="crime heat" />
      <Rail label="WLT" active={heatMode === 'wealth'} onClick={() => setHeatMode('wealth')} tone="#95b876" hint="wealth heat" />
      <Rail label="MOD" active={heatMode === 'mood'} onClick={() => setHeatMode('mood')} tone="#4ec5b8" hint="sentiment" />
    </div>
  );
}

function Rail({ label, active, onClick, tone, hint }: { label: string; active: boolean; onClick: () => void; tone: string; hint?: string }) {
  return (
    <button
      onClick={onClick}
      title={hint ?? label}
      className="pixel"
      style={{
        width: 32,
        height: 28,
        border: `1px solid ${active ? tone : '#2a2236'}`,
        background: active ? tone : '#1c1925',
        color: active ? '#0b0a10' : tone,
        fontSize: 9,
        letterSpacing: '0.1em',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      {label}
    </button>
  );
}
