'use client';
import { useWorld } from '../lib/store';
import { dayPhaseFromSimTime } from '../lib/iso';
import { dayPhaseName } from '../lib/sprite-helpers';

export default function BottomBar() {
  const speed = useWorld((s) => s.speed);
  const setSpeed = useWorld((s) => s.setSpeed);
  const paused = useWorld((s) => s.paused);
  const setPaused = useWorld((s) => s.setPaused);
  const heatMode = useWorld((s) => s.heatMode);
  const setHeatMode = useWorld((s) => s.setHeatMode);
  const tour = useWorld((s) => s.tourMode);
  const setTour = useWorld((s) => s.setTourMode);
  const simTime = useWorld((s) => s.simTime);
  const dayPhase = dayPhaseFromSimTime(simTime);

  return (
    <div
      className="panel"
      style={{
        position: 'absolute',
        left: 16,
        right: 372,
        bottom: 16,
        height: 56,
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: 14,
        alignItems: 'center',
        padding: '0 14px',
        zIndex: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="panel-title" style={{ marginRight: 8 }}>
          ▌ SPEED
        </span>
        <button
          className="iconbtn"
          onClick={() => setPaused(!paused)}
          title={paused ? 'play' : 'pause'}
        >
          {paused ? '▶' : '❚❚'}
        </button>
        {[1, 2, 4, 8].map((s) => (
          <span
            key={s}
            className={`chip ${!paused && s === speed ? 'active' : ''}`}
            onClick={() => {
              setPaused(false);
              setSpeed(s);
            }}
          >
            {s}×
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="panel-title" style={{ marginRight: 8 }}>
          ▌ OVERLAYS
        </span>
        <span className={`chip ${heatMode === 'none' ? 'active' : ''}`} onClick={() => setHeatMode('none')}>
          none
        </span>
        <span
          className={`chip ${heatMode === 'crime' ? 'active' : ''}`}
          onClick={() => setHeatMode('crime')}
          style={
            heatMode === 'crime'
              ? { background: '#8e2738', borderColor: '#e2536e', color: '#ece6d3' }
              : undefined
          }
        >
          crime heat
        </span>
        <span
          className={`chip ${heatMode === 'wealth' ? 'active' : ''}`}
          onClick={() => setHeatMode('wealth')}
          style={
            heatMode === 'wealth'
              ? { background: '#4f7a3d', borderColor: '#95b876', color: '#ece6d3' }
              : undefined
          }
        >
          wealth heat
        </span>
        <span
          className={`chip ${heatMode === 'mood' ? 'active' : ''}`}
          onClick={() => setHeatMode('mood')}
          style={
            heatMode === 'mood'
              ? { background: '#1f7c75', borderColor: '#4ec5b8', color: '#ece6d3' }
              : undefined
          }
        >
          sentiment
        </span>
        <span style={{ width: 1, alignSelf: 'stretch', background: '#2a2236', margin: '0 8px' }} />
        <span className={`chip ${tour ? 'active' : ''}`} onClick={() => setTour(!tour)}>
          {tour ? '◉ tour mode' : '◌ tour mode'}
        </span>
      </div>

      <DayNightStrip dayPhase={dayPhase} />
    </div>
  );
}

function DayNightStrip({ dayPhase }: { dayPhase: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span className="panel-title">▌ SUN</span>
      <div style={{ position: 'relative', width: 200, height: 18, border: '1px solid #3a304a', background: '#0b0a10' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(90deg, #1a2244 0%, #7a4030 18%, #c8a04a 30%, #ffc26b 50%, #c8a04a 70%, #b9522a 82%, #1a2244 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: -3,
            bottom: -3,
            left: `${dayPhase * 100}%`,
            width: 3,
            background: '#ffc26b',
            boxShadow: '0 0 6px #ffc26b',
          }}
        />
      </div>
      <span className="mono" style={{ fontSize: 10, color: '#8a8478', width: 64 }}>
        {dayPhaseName(dayPhase)}
      </span>
    </div>
  );
}
