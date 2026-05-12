// TheColony — app shell
//
// Drives the sim clock, advances agents along simple paths between
// (home → work → bar → home), fires bubbles and money floats, feeds the
// event ticker. Wires up the HUD, drawer, and tweaks panel.

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ── initial agent runtime state ──────────────────────────────────────────────
function initRuntimeAgents() {
  return window.AGENTS.map((a, i) => {
    const home = window.BUILDING_BY_ID[a.home || 'B18'];
    const startX = home ? home.x + home.w/2 : (i % 8) - 4;
    const startY = home ? home.y + home.h/2 : Math.floor(i / 8) - 4;
    return {
      id: a.id,
      pos:    { tx: startX, ty: startY },
      target: { tx: startX, ty: startY },
      path:   [],
      state: 'idle',         // idle | walking | working | sleeping | eating | speaking
      stateUntilT: 0,
      lastBubbleT: -100,
      needs: {
        hunger: 30 + (i * 7) % 50,
        energy: 40 + (i * 11) % 50,
        social: 30 + (i * 5) % 60,
        money_anxiety: a.balance < 0 ? 85 : (i * 13) % 70 + 10,
        life_satisfaction: a.mood >= 0 ? 60 + (i*3)%30 : 18 + (i*7)%30,
      },
    };
  });
}

// pick a sensible target for an agent given simTime and their character
function pickTarget(a, ra, simTime) {
  const meta = window.AGENT_BY_ID[a.id];
  const hourOfDay = (simTime / 60) % 24;
  const candidates = [];

  if (meta.work && hourOfDay >= 6 && hourOfDay <= 19) candidates.push(meta.work);
  if (meta.home) candidates.push(meta.home);
  // socializing
  if (hourOfDay >= 18 && hourOfDay <= 23) {
    candidates.push('B14', 'B16', 'B18');  // Lantern, Cup&Saucer, Bell Park
  }
  // wandering
  candidates.push('B18', 'B15', 'B04', 'B14');

  const pick = candidates[(Math.floor(simTime/47) + a.id.charCodeAt(2)) % candidates.length];
  const b = window.BUILDING_BY_ID[pick];
  if (!b) return ra.pos;
  // pick a tile inside the footprint, or at its door
  return {
    tx: b.x + b.w/2 - 0.5 + ((a.id.charCodeAt(1) % 3) - 1) * 0.4,
    ty: b.y + b.h/2 - 0.5 + ((a.id.charCodeAt(2) % 3) - 1) * 0.4,
  };
}

// ── App ──────────────────────────────────────────────────────────────────────
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "speed": 4,
  "dayPhase": 0.62,
  "showHeat": "none",
  "tour": false,
  "paused": false,
  "showScanlines": true,
  "selectedId": "A01"
}/*EDITMODE-END*/;

function App() {
  // tweaks state
  const [t, setTweak] = window.useTweaks(TWEAK_DEFAULTS);

  // sim state
  const [simTime, setSimTime] = useState(7 * 60 + 14); // start at ~ 07:14
  const [runtime, setRuntime] = useState(initRuntimeAgents);
  const [events,  setEvents]  = useState(window.SEED_EVENTS);
  const [bubbles, setBubbles] = useState([]);
  const [floats,  setFloats]  = useState([]);

  // ui state
  const [selected, setSelected] = useState(() =>
    TWEAK_DEFAULTS.selectedId ? { kind:'agent', id: TWEAK_DEFAULTS.selectedId } : null
  );
  const [hovered,  setHovered]  = useState(null);
  const [follow,   setFollow]   = useState(null);

  // animation tick
  useEffect(() => {
    let last = performance.now();
    let raf;
    const loop = (now) => {
      const dtReal = (now - last) / 1000;
      last = now;

      if (!t.paused) {
        const dtSim = dtReal * t.speed * 4; // 1× speed → ~4 sim-min/real-sec for nicer pacing
        setSimTime(s => s + dtSim);

        // age bubbles + floats
        setBubbles(bs => bs
          .map(b => ({ ...b, age: b.age + dtReal / 4 }))
          .filter(b => b.age < 1));
        setFloats(fs => fs
          .map(f => ({ ...f, age: f.age + dtReal / 1.6 }))
          .filter(f => f.age < 1));

        // advance agents
        setRuntime(rs => rs.map(ra => {
          const meta = window.AGENT_BY_ID[ra.id];
          if (!meta) return ra;
          // already at target?
          const dx = ra.target.tx - ra.pos.tx;
          const dy = ra.target.ty - ra.pos.ty;
          const dist = Math.hypot(dx, dy);
          if (dist < 0.05) {
            // sometimes pick a new target
            const shouldRepick = (Math.sin(simTime/13 + ra.id.charCodeAt(1)) > 0.6) || ra.state === 'idle';
            if (shouldRepick) {
              const target = pickTarget(meta, ra, simTime);
              return { ...ra, target, state: 'walking' };
            }
            return { ...ra, state: 'idle' };
          }
          const speed = 0.7 * (dtSim / 60);  // tiles per sim-min
          const step = Math.min(dist, speed);
          return {
            ...ra,
            pos: { tx: ra.pos.tx + dx/dist * step, ty: ra.pos.ty + dy/dist * step },
            state: 'walking',
          };
        }));
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [t.paused, t.speed]);

  // every ~6 sim-min, emit a plausible new event + bubble
  const lastEmitRef = useRef(simTime);
  useEffect(() => {
    if (simTime - lastEmitRef.current < 6) return;
    lastEmitRef.current = simTime;
    const ev = generateEvent(simTime, runtime);
    if (ev) {
      setEvents(es => [ev, ...es].slice(0, 80));
      if (ev.bubbleAgent) {
        setBubbles(bs => [...bs, {
          id: ev.id, agentId: ev.bubbleAgent, text: ev.bubbleText, age: 0,
        }]);
      }
      if (ev.float) {
        setFloats(fs => [...fs, ev.float]);
      }
    }
  }, [simTime, runtime]);

  // tour mode — auto-pick interesting events
  useEffect(() => {
    if (!t.tour) return;
    const id = setInterval(() => {
      const hot = events.find(e => e.importance >= 7);
      const refs = (hot?.body || []).filter(p => p && (p.a || p.b));
      if (refs.length) {
        const r = refs[0];
        if (r.a) setSelected({ kind:'agent', id:r.a });
        else if (r.b) setSelected({ kind:'building', id:r.b });
      }
    }, 8000);
    return () => clearInterval(id);
  }, [t.tour, events]);

  // day/night phase — slow drift across day, or hold to tweak
  const dayPhase = (((simTime / 60) % 24) / 24);

  // sim metrics
  const pop = { alive: window.AGENTS.filter(a => a.status==='alive').length, births: 2, deaths: 1 };
  const gdp = { now: 1_842_000_00, delta: -0.012 };
  const crime = { rate: 0.34, warrants: 8 };
  const mood = { value: -6 };

  const onPick = useCallback((sel) => setSelected(sel), []);

  return (
    <div style={{ position:'fixed', inset:0, background:'#0b0a10', overflow:'hidden' }}>

      <CityCanvas
        simTime={simTime}
        agents={runtime}
        events={{ bubbles, floats }}
        hoveredId={hovered}
        selectedId={selected}
        setSelected={setSelected}
        setHovered={setHovered}
        heatMode={t.showHeat}
        dayPhase={dayPhase}
        paused={t.paused}
      />

      <TopBar
        simTime={simTime}
        pop={pop} gdp={gdp} crime={crime} mood={mood}
        speed={t.speed} paused={t.paused}
      />

      <EventTicker events={events} onPick={onPick} simTime={simTime} />

      <BottomBar
        speed={t.speed} setSpeed={(s) => setTweak('speed', s)}
        paused={t.paused} setPaused={(fn) => setTweak('paused', typeof fn==='function' ? fn(t.paused) : fn)}
        heatMode={t.showHeat} setHeatMode={(m) => setTweak('showHeat', m)}
        dayPhase={dayPhase}
        tour={t.tour} setTour={(fn) => setTweak('tour', typeof fn==='function' ? fn(t.tour) : fn)}
      />

      <Drawer
        selected={selected}
        onClose={() => setSelected(null)}
        onPick={onPick}
        follow={follow}
        setFollow={setFollow}
        agents={runtime}
      />

      {/* Tweaks panel — opt-in via toolbar */}
      <ColonyTweaks t={t} setTweak={setTweak} />

      {/* Footer attribution + keyboard hints */}
      <div style={{
        position:'absolute', left:16, bottom:80,
        fontFamily:'"JetBrains Mono", monospace', fontSize:10, color:'#5e5868',
        background:'rgba(11,10,16,0.7)', border:'1px solid #2a2236', padding:'4px 8px',
      }}>
        DRAG · pan &nbsp; SCROLL · zoom &nbsp; CLICK · open dossier &nbsp; F · follow
      </div>

    </div>
  );
}

// ── event generator ──────────────────────────────────────────────────────────
function generateEvent(simTime, runtime) {
  const t = window.fmtSimClock(simTime);
  const pool = [
    () => {
      // crime — Wren picks a pocket
      const a = window.AGENT_BY_ID['A06'];
      const ra = runtime.find(r => r.id === 'A06');
      const screen = window.isoToScreen(ra.pos.tx, ra.pos.ty);
      return {
        id: simTime+'/06', t, kind:'crime', importance:7,
        body:[{a:'A06'},' pocketed $', '4 from a passerby near ', {b:'B15'}, '. Witness yet?'],
        bubbleAgent:'A06', bubbleText:'didn\'t take much.',
        float:{ id:simTime+'/06f', x:screen.x+8, y:screen.y, amount:4, age:0 },
      };
    },
    () => {
      const screen = (() => { const ra = runtime.find(r => r.id === 'A05'); return window.isoToScreen(ra.pos.tx, ra.pos.ty); })();
      return {
        id: simTime+'/05', t, kind:'speak', importance:5,
        body:[{a:'A05'},' (at ',{b:'B14'},'): "If Rook calls a strike, half the docks come with him."'],
        bubbleAgent:'A05', bubbleText:'half the docks come with him.',
      };
    },
    () => {
      const ra = runtime.find(r => r.id === 'A03');
      const screen = window.isoToScreen(ra.pos.tx, ra.pos.ty);
      return {
        id: simTime+'/03', t, kind:'trade', importance:6,
        body:[{a:'A03'},' bought 800 shares of Hollow Mill at $44. Open interest now leaning long.'],
        float:{ id:simTime+'/03f', x:screen.x, y:screen.y, amount: -35200, age:0 },
      };
    },
    () => ({
      id: simTime+'/14', t, kind:'fire', importance:8,
      body:[{a:'A01'},' refused negotiation. ',{a:'A14'},' walked off Riverside Foods floor.'],
      bubbleAgent:'A01', bubbleText:'we are done discussing.',
    }),
    () => ({
      id: simTime+'/04', t, kind:'reflect', importance:4,
      body:[{a:'A04'},' added 2 listeners to Children of the Dust at ',{b:'B18'},'.'],
      bubbleAgent:'A04', bubbleText:'the bell does not lie.',
    }),
    () => ({
      id: simTime+'/07', t, kind:'meet', importance:5,
      body:[{a:'A07'},' met privately with ',{a:'A03'},' at ',{b:'B04'},'. Topic: courthouse collateral.'],
    }),
    () => ({
      id: simTime+'/10', t, kind:'court', importance:6,
      body:[{a:'A12'},' issued a 3rd warrant for ',{a:'A06'},'. Bounty posted: $80.'],
    }),
    () => {
      const ra = runtime.find(r => r.id === 'A02');
      const screen = window.isoToScreen(ra.pos.tx, ra.pos.ty);
      return {
        id: simTime+'/02', t, kind:'speak', importance:5,
        body:[{a:'A02'},': "My girls eat tonight. The cannery does not."'],
        bubbleAgent:'A02', bubbleText:'my girls eat tonight.',
      };
    },
  ];
  const fn = pool[Math.floor(simTime/3) % pool.length];
  return fn();
}

// ── Tweaks panel ─────────────────────────────────────────────────────────────
function ColonyTweaks({ t, setTweak }) {
  const TP = window.TweaksPanel;
  if (!TP) return null;
  return (
    <TP title="Tweaks">
      <window.TweakSection label="Simulation">
        <window.TweakRadio
          label="Speed"
          value={t.speed}
          options={[
            { label:'1×', value:1 },
            { label:'2×', value:2 },
            { label:'4×', value:4 },
            { label:'8×', value:8 },
          ]}
          onChange={(v) => setTweak('speed', v)}
        />
        <window.TweakToggle
          label="Pause sim"
          value={t.paused}
          onChange={(v) => setTweak('paused', v)}
        />
        <window.TweakToggle
          label="Tour mode (auto-pick events)"
          value={t.tour}
          onChange={(v) => setTweak('tour', v)}
        />
      </window.TweakSection>

      <window.TweakSection label="View">
        <window.TweakRadio
          label="Heat overlay"
          value={t.showHeat}
          options={[
            { label:'None',   value:'none' },
            { label:'Crime',  value:'crime' },
            { label:'Wealth', value:'wealth' },
            { label:'Mood',   value:'mood' },
          ]}
          onChange={(v) => setTweak('showHeat', v)}
        />
      </window.TweakSection>

      <window.TweakSection label="About">
        <div style={{ fontSize: 11, color: '#8a8478', lineHeight: 1.4 }}>
          Every citizen is an AI agent trying to survive. The world is sealed; visitors only observe.
          Click any agent or building to open its dossier.
        </div>
      </window.TweakSection>
    </TP>
  );
}

// Defer mount one tick so every sibling Babel script has finished attaching
// its window.* exports before App() first runs.
setTimeout(() => {
  try {
    ReactDOM.createRoot(document.getElementById('root')).render(<App />);
  } catch (e) {
    document.getElementById('root').innerHTML =
      '<pre style="color:#e2536e;padding:20px;font-family:monospace;white-space:pre-wrap">'
      + (e.stack || e.message) + '</pre>';
    throw e;
  }
}, 0);
