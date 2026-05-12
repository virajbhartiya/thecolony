// TheColony — isometric city renderer (SVG)
//
// Pan/zoom via a wrapping <svg> transform. Renders ground tiles, road network,
// buildings, agents, speech bubbles, floating money.

const GROUND_RADIUS = 14;  // half-extent of ground in tiles; we render
                            // a diamond from (-R..R, -R..R) approximately

function makeGroundTiles() {
  const tiles = [];
  for (let ty = -GROUND_RADIUS; ty <= GROUND_RADIUS; ty++) {
    for (let tx = -GROUND_RADIUS; tx <= GROUND_RADIUS; tx++) {
      // skew the ground a bit with a pseudo-noise so it's not flat
      const n = (Math.sin(tx*1.3 + ty*0.7) + Math.cos(tx*0.5 - ty*1.1)) * 0.5;
      let fill = '#3a5530';
      if (n > 0.55) fill = '#4a6839';
      else if (n < -0.5) fill = '#2c4022';
      tiles.push({ tx, ty, fill });
    }
  }
  return tiles;
}

// roads: simple list of segments between named tile points
// each segment is a line of road tiles
const ROAD_SEGMENTS = [
  // east-west spine through downtown
  { a:[-13, 0], b:[ 13, 0] },
  // north-south spine
  { a:[  0,-13], b:[  0, 13] },
  // east leg toward industry
  { a:[  0,-4], b:[ 12,-4] },
  { a:[  0, 4], b:[ 12, 4] },
  // residential west
  { a:[ -8,-7], b:[ -8, 9] },
  // north financial belt
  { a:[-6,-7], b:[ 6,-7] },
  // south civic belt
  { a:[-4, 7], b:[ 9, 7] },
];

function expandRoads() {
  const tiles = new Set();
  ROAD_SEGMENTS.forEach(({a,b}) => {
    if (a[0] === b[0]) {
      const x = a[0];
      const [y0,y1] = [Math.min(a[1],b[1]), Math.max(a[1],b[1])];
      for (let y = y0; y <= y1; y++) tiles.add(`${x},${y}`);
    } else if (a[1] === b[1]) {
      const y = a[1];
      const [x0,x1] = [Math.min(a[0],b[0]), Math.max(a[0],b[0])];
      for (let x = x0; x <= x1; x++) tiles.add(`${x},${y}`);
    }
  });
  return [...tiles].map(s => {
    const [tx,ty] = s.split(',').map(Number); return {tx,ty};
  });
}

// is a tile inside a building footprint?
function tileInBuilding(tx, ty) {
  return window.BUILDINGS.some(b =>
    tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h);
}

function CityCanvas({
  simTime, agents, events, hoveredId, selectedId, setSelected, setHovered,
  heatMode, dayPhase, paused,
}) {
  const groundTiles = React.useMemo(makeGroundTiles, []);
  const roadTiles = React.useMemo(() => expandRoads(), []);

  const [view, setView] = React.useState({ scale: 1.05, x: 0, y: 40 });
  const dragging = React.useRef(null);

  // Pan handlers
  const onPointerDown = (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    dragging.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
  };
  const onPointerMove = (e) => {
    if (!dragging.current) return;
    setView(v => ({ ...v,
      x: dragging.current.vx + (e.clientX - dragging.current.x),
      y: dragging.current.vy + (e.clientY - dragging.current.y),
    }));
  };
  const onPointerUp = () => { dragging.current = null; };
  const onWheel = (e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0012;
    setView(v => ({ ...v, scale: Math.max(0.5, Math.min(2.4, v.scale + delta)) }));
  };

  // night tint
  const tint = nightTintForPhase(dayPhase);
  const litWindows = dayPhase < 0.22 || dayPhase > 0.78;

  // heat helpers
  const buildingHeat = (b) => {
    if (heatMode === 'crime') {
      if (b.kind === 'jail' || b.kind === 'court') return { color:'#e2536e', alpha:0.5 };
      if (b.kind === 'bar' || b.kind === 'shop')  return { color:'#e2536e', alpha:0.25 };
    }
    if (heatMode === 'wealth') {
      if (b.kind === 'bank' || b.kind === 'house_big' || b.kind === 'office') return { color:'#95b876', alpha:0.55 };
      if (b.kind === 'apartment')   return { color:'#95b876', alpha:0.2 };
    }
    if (heatMode === 'mood') {
      if (b.kind === 'park' || b.kind === 'cafe' || b.kind === 'bar') return { color:'#4ec5b8', alpha:0.45 };
      if (b.kind === 'jail' || b.kind === 'factory') return { color:'#9b7fd1', alpha:0.4 };
    }
    return null;
  };
  const agentHeat = (a) => {
    if (heatMode === 'crime' && a.flags?.includes('wanted')) return { color:'#e2536e', alpha:1 };
    if (heatMode === 'wealth') {
      if (a.balance > 100_000_00) return { color:'#95b876', alpha:1 };
      if (a.balance < 0) return { color:'#9b7fd1', alpha:1 };
    }
    if (heatMode === 'mood') {
      if (a.mood < -20) return { color:'#e2536e', alpha:1 };
      if (a.mood > 10)  return { color:'#4ec5b8', alpha:1 };
    }
    return null;
  };

  // bubbles + floats from recent events
  const bubbles = events.bubbles || [];
  const floats  = events.floats  || [];

  return (
    <div
      style={{ position:'absolute', inset:0, overflow:'hidden', cursor: dragging.current ? 'grabbing' : 'grab', background:'#0b0a10' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onWheel={onWheel}
    >
      {/* sky gradient backdrop */}
      <div style={{
        position:'absolute', inset:0,
        background: `radial-gradient(ellipse at 50% 35%, ${skyTopForPhase(dayPhase)} 0%, #0b0a10 78%)`,
      }} />
      {/* distant horizon stars at night */}
      {dayPhase > 0.78 || dayPhase < 0.18 ? (
        <div style={{ position:'absolute', inset:0 }}>
          {STAR_FIELD.map((s,i) => (
            <span key={i} style={{
              position:'absolute', left:`${s.x}%`, top:`${s.y * 0.5}%`,
              width:2, height:2, background:'#ece6d3',
              opacity: 0.4 + Math.sin(performance.now()/600 + i) * 0.3,
            }} />
          ))}
        </div>
      ) : null}

      <svg
        width="100%" height="100%"
        viewBox={`${-700} ${-450} 1400 900`}
        style={{ position:'absolute', inset:0, display:'block' }}
      >
        <g transform={`translate(${view.x}, ${view.y}) scale(${view.scale})`}>
          {/* GROUND */}
          <g>
            {groundTiles.map(t => (
              <TileDiamond key={`g${t.tx},${t.ty}`} tx={t.tx} ty={t.ty} fill={t.fill} />
            ))}
          </g>
          {/* ROADS */}
          <g>
            {roadTiles.filter(t => !tileInBuilding(t.tx, t.ty)).map(t => (
              <TileDiamond key={`r${t.tx},${t.ty}`} tx={t.tx} ty={t.ty} fill="#2c2630" stroke="#1a1820" />
            ))}
            {/* road center markings on east-west spine */}
            {roadTiles.filter(t => t.ty === 0 && t.tx % 2 === 0 && !tileInBuilding(t.tx, t.ty)).map(t => {
              const { x, y } = isoToScreen(t.tx, t.ty);
              return <rect key={`m${t.tx}`} x={x - 2} y={y - 1} width="4" height="2" fill="#6b6478" />;
            })}
          </g>

          {/* WATER strip on far east */}
          <g>
            {Array.from({length:18}).map((_,i) => {
              const tx = 13, ty = -8 + i;
              const { x, y } = isoToScreen(tx, ty);
              const w = window.TILE_W, h = window.TILE_H;
              const wave = Math.sin(performance.now()/400 + i*0.6) * 0.6;
              return (
                <polygon key={`w${i}`}
                  points={`${x},${y - h/2 + wave} ${x + w/2},${y + wave} ${x},${y + h/2 + wave} ${x - w/2},${y + wave}`}
                  fill="#2f6e7a" stroke="#1f5660" />
              );
            })}
          </g>

          {/* BUILDINGS — sort by depth (ty + tx) so back ones render first */}
          <g>
            {[...window.BUILDINGS]
              .sort((a,b) => (a.x + a.y) - (b.x + b.y))
              .map(b => (
                <g
                  key={b.id}
                  onClick={(e) => { e.stopPropagation(); setSelected({ kind:'building', id:b.id }); }}
                  onMouseEnter={() => setHovered({ kind:'building', id:b.id })}
                  onMouseLeave={() => setHovered(null)}
                >
                  <BuildingSprite
                    b={b}
                    hovered={hoveredId?.kind === 'building' && hoveredId.id === b.id}
                    selected={selectedId?.kind === 'building' && selectedId.id === b.id}
                    lit={litWindows}
                    heat={buildingHeat(b)}
                  />
                </g>
            ))}
          </g>

          {/* AGENTS — sort by world y so south agents draw on top */}
          <g>
            {[...agents]
              .sort((a,b) => (a.pos.tx + a.pos.ty) - (b.pos.tx + b.pos.ty))
              .map(a => {
                const { x, y } = isoToScreen(a.pos.tx, a.pos.ty);
                return (
                  <g key={a.id}
                    onClick={(e) => { e.stopPropagation(); setSelected({ kind:'agent', id:a.id }); }}
                    onMouseEnter={() => setHovered({ kind:'agent', id:a.id })}
                    onMouseLeave={() => setHovered(null)}>
                    <AgentSprite a={a} x={x} y={y}
                      walking={a.state === 'walking'}
                      selected={selectedId?.kind === 'agent' && selectedId.id === a.id}
                      hovered={hoveredId?.kind === 'agent' && hoveredId.id === a.id}
                      heat={agentHeat(a)} />
                  </g>
                );
            })}
          </g>

          {/* NIGHT TINT (in-svg, scales with map) — actually applied as outer overlay below */}
        </g>
      </svg>

      {/* SPEECH BUBBLES + MONEY FLOATS (overlay positioned in screen space) */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
        {bubbles.map(b => {
          const agent = window.AGENT_BY_ID[b.agentId];
          if (!agent) return null;
          const { x, y } = isoToScreen(agent.pos.tx, agent.pos.ty);
          return (
            <div key={b.id} className="bubble" style={{
              left: 700 + view.x + x * view.scale,
              top:  450 + view.y + (y - 22) * view.scale,
              opacity: 1 - b.age,
            }}>{b.text}</div>
          );
        })}
        {floats.map(f => {
          return (
            <div key={f.id}
              className={`money-float ${f.amount > 0 ? 'up' : 'down'}`}
              style={{
                left: 700 + view.x + f.x * view.scale,
                top:  450 + view.y + (f.y - 14 - f.age * 24) * view.scale,
                opacity: 1 - f.age,
            }}>{f.amount > 0 ? '+' : ''}${Math.abs(f.amount)}</div>
          );
        })}
      </div>

      {/* DAY/NIGHT TINT — full overlay (over everything except HUD) */}
      <div style={{
        position:'absolute', inset:0,
        background: tint.color,
        mixBlendMode: 'multiply',
        opacity: tint.alpha,
        pointerEvents:'none',
      }} />
      {/* atmospheric vignette */}
      <div style={{
        position:'absolute', inset:0,
        background:'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%)',
        pointerEvents:'none',
      }} />
      <div className="scanlines" />

      {/* PAUSED indicator */}
      {paused && (
        <div style={{
          position:'absolute', top:60, left:'50%', transform:'translateX(-50%)',
          color:'#ffc26b', fontFamily:'"Silkscreen", monospace',
          fontSize:14, letterSpacing:'0.2em',
          background:'rgba(11,10,16,0.78)', border:'1px solid #f0a347',
          padding:'4px 14px',
        }}>◼ PAUSED</div>
      )}

      {/* compass / scale */}
      <div style={{
        position:'absolute', right:380, bottom:80,
        fontFamily:'"Silkscreen", monospace', fontSize:9, color:'#8a8478',
        letterSpacing:'0.18em', pointerEvents:'none',
      }}>
        <div style={{ marginBottom: 4 }}>N ↑</div>
        <div style={{ width:60, height:1, background:'#5e5868' }} />
        <div style={{ marginTop:2 }}>{Math.round(view.scale * 100)}% · TILE 56×28</div>
      </div>
    </div>
  );
}

// stars
const STAR_FIELD = Array.from({length: 60}).map(() => ({
  x: Math.random() * 100, y: Math.random() * 60,
}));

// Day/night
// dayPhase ∈ [0..1]; 0.0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk
function nightTintForPhase(p) {
  // night = deep navy multiply, dawn/dusk = warm orange
  if (p < 0.18 || p > 0.85)       return { color:'#1a2244', alpha:0.55 };
  if (p < 0.27)                   return { color:'#7a4030', alpha:0.30 }; // dawn
  if (p > 0.72)                   return { color:'#b9522a', alpha:0.34 }; // dusk
  if (p > 0.78)                   return { color:'#4a2a3a', alpha:0.45 };
  return { color:'#ffffff', alpha:0.0 }; // day
}
function skyTopForPhase(p) {
  if (p < 0.18 || p > 0.85) return '#162042';
  if (p < 0.27)             return '#a55a3a';
  if (p > 0.72)             return '#c46e3a';
  return '#5a7a98';
}

Object.assign(window, { CityCanvas });
