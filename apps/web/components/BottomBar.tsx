'use client';
import { useWorld } from '../lib/store';
import { dayPhaseFromSimTime } from '../lib/iso';
import { dayPhaseName } from '../lib/sprite-helpers';

export default function BottomBar() {
  const speed = useWorld((s) => s.speed);
  const setSpeed = useWorld((s) => s.setSpeed);
  const paused = useWorld((s) => s.paused);
  const setPaused = useWorld((s) => s.setPaused);
  const tour = useWorld((s) => s.tourMode);
  const setTour = useWorld((s) => s.setTourMode);
  const simTime = useWorld((s) => s.simTime);
  const dayPhase = dayPhaseFromSimTime(simTime);

  return (
    <div
      className="panel"
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 12,
        height: 36,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 10px',
        zIndex: 20,
      }}
    >
      <button
        onClick={() => setPaused(!paused)}
        className="iconbtn"
        title={paused ? 'play' : 'pause'}
        style={{ width: 22, height: 22 }}
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
          style={{ padding: '1px 6px' }}
        >
          {s}×
        </span>
      ))}

      <Sep />

      <span className={`chip ${tour ? 'active' : ''}`} onClick={() => setTour(!tour)} style={{ padding: '1px 7px' }}>
        {tour ? '◉ tour' : '◌ tour'}
      </span>

      <div style={{ flex: 1 }} />

      <DayNightStrip dayPhase={dayPhase} />
    </div>
  );
}

function Sep() {
  return <span style={{ width: 1, alignSelf: 'stretch', background: '#2a2236', margin: '6px 0' }} />;
}

function DayNightStrip({ dayPhase }: { dayPhase: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span className="pixel" style={{ fontSize: 9, color: '#8a8478', letterSpacing: '0.18em' }}>
        SUN
      </span>
      <div style={{ position: 'relative', width: 160, height: 12, border: '1px solid #3a304a', background: '#0b0a10' }}>
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
            top: -2,
            bottom: -2,
            left: `${dayPhase * 100}%`,
            width: 2,
            background: '#ffc26b',
            boxShadow: '0 0 6px #ffc26b',
          }}
        />
      </div>
      <span className="mono" style={{ fontSize: 10, color: '#8a8478', width: 56 }}>
        {dayPhaseName(dayPhase)}
      </span>
    </div>
  );
}
