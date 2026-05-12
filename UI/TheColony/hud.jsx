// TheColony — HUD overlay components
// Lives on top of the city canvas. Reads world state; never mutates.

// ── helpers ──────────────────────────────────────────────────────────────────
function fmtMoney(cents) {
  const sign = cents < 0 ? '-' : '';
  const v = Math.abs(cents) / 100;
  if (v >= 1_000_000) return `${sign}$${(v/1_000_000).toFixed(2)}M`;
  if (v >= 1000)      return `${sign}$${(v/1000).toFixed(1)}k`;
  return `${sign}$${v.toFixed(2)}`;
}
function fmtSimClock(t) {
  // t is sim minutes since epoch
  const hours = Math.floor(t / 60) % 24;
  const mins  = Math.floor(t % 60);
  return `${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}`;
}
function fmtSimDate(t) {
  // 1 sim day = 1440 sim minutes; start on Day 412
  const day = 412 + Math.floor(t / 1440);
  return `D${day}`;
}

// ── TOP BAR ──────────────────────────────────────────────────────────────────
function TopBar({ simTime, pop, gdp, crime, mood, speed, paused }) {
  return (
    <div className="panel" style={{
      position:'absolute', top:16, left:16, right:16, height:56,
      display:'grid',
      gridTemplateColumns:'auto 1fr auto',
      alignItems:'center',
      zIndex: 20,
    }}>
      {/* LOGO BLOCK */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'0 16px', borderRight:'1px solid #2a2236', height:'100%' }}>
        <svg width="28" height="28" viewBox="0 0 28 28">
          <rect x="2" y="14" width="24" height="12" fill="#1c1925" stroke="#f0a347" strokeWidth="1.5"/>
          <rect x="6" y="6" width="6" height="20" fill="#f0a347" />
          <rect x="14" y="2" width="6" height="24" fill="#ffc26b" />
          <rect x="22" y="10" width="4" height="16" fill="#4ec5b8" />
          <rect x="0" y="26" width="28" height="2" fill="#0b0a10" />
        </svg>
        <div>
          <div className="pixel" style={{ fontSize:14, color:'#ffc26b', letterSpacing:'0.16em' }}>THECOLONY</div>
          <div className="mono" style={{ fontSize:9, color:'#8a8478', letterSpacing:'0.18em' }}>LIVE · TICK 18,422,910</div>
        </div>
      </div>

      {/* METRICS */}
      <div style={{ display:'flex', alignItems:'stretch', height:'100%' }}>
        <Metric label="SIM CLOCK" value={fmtSimClock(simTime)} sub={fmtSimDate(simTime)} accent="#ffc26b" />
        <Metric label="POPULATION" value={String(pop.alive)} sub={`+${pop.births} / -${pop.deaths} today`} />
        <Metric label="GDP / SIM-DAY" value={fmtMoney(gdp.now)} sub={<span className={gdp.delta>=0?'delta-up':'delta-down'}>{gdp.delta>=0?'▲':'▼'} {Math.abs(gdp.delta*100).toFixed(1)}%</span>} />
        <Metric label="CRIME RATE" value={`${(crime.rate*100).toFixed(0)}/d`} sub={<span className="delta-down">▲ {crime.warrants} warrants</span>} />
        <Metric label="MOOD INDEX" value={`${mood.value>=0?'+':''}${mood.value}`} sub={<span style={{color:mood.value<0?'#e2536e':'#95b876'}}>{moodLabel(mood.value)}</span>} accent={mood.value<0?'#e2536e':'#95b876'} />
        <Metric label="ECON SHOCK" value="LO" sub={<span style={{color:'#9b7fd1'}}>strike risk +3</span>} />
      </div>

      {/* RIGHT CTRL */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'0 14px' }}>
        <div className="mono" style={{ fontSize:10, color:'#8a8478' }}>
          <div>WALL · {new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
          <div>SPEED · {paused ? '0×' : speed + '×'}</div>
        </div>
        <span className="pill" style={{ color: paused ? '#f0a347' : '#95b876' }}>
          <span style={{ width:6, height:6, background:'currentColor', borderRadius:'50%' }} />
          {paused ? 'PAUSED' : 'LIVE'}
        </span>
      </div>
    </div>
  );
}

function Metric({ label, value, sub, accent }) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={{ color: accent || '#ece6d3' }}>{value}</div>
      <div className="metric-delta">{sub}</div>
    </div>
  );
}

function moodLabel(v) {
  if (v <= -20) return 'restless';
  if (v <= -8)  return 'sour';
  if (v <  8)   return 'flat';
  if (v <  20)  return 'warming';
  return 'lifted';
}

// ── EVENT TICKER ─────────────────────────────────────────────────────────────
const KIND_COLOR = {
  fire:'#e2536e', crime:'#e2536e', death:'#8e2738',
  speak:'#ffc26b', meet:'#f0a347', reflect:'#9b7fd1',
  trade:'#95b876', wage:'#95b876', court:'#9b7fd1',
};

function EventTicker({ events, onPick, simTime }) {
  return (
    <div className="panel" style={{
      position:'absolute', top:84, right:16, width:340, bottom:84,
      display:'flex', flexDirection:'column',
      zIndex: 20,
    }}>
      <div className="panel-header">
        <span className="panel-title">▌ Live Firehose</span>
        <span className="panel-tag">{events.length} EVENTS</span>
      </div>
      <div style={{ overflowY:'auto', flex:'0 0 auto', maxHeight:'62%' }}>
        {events.slice(0, 14).map((e, i) => (
          <div key={e.id} className={`event-row ${i === 0 ? 'new' : ''}`}>
            <span className="t mono">{e.t}</span>
            <span className="dot" style={{ background: KIND_COLOR[e.kind] || '#8a8478' }} />
            <span className="body">{renderEventBody(e.body, onPick)}</span>
          </div>
        ))}
      </div>

      {/* Leaderboards below */}
      <div style={{ borderTop:'1px solid #3a304a', flex:1, overflowY:'auto' }}>
        <Leaderboard
          title="Richest"
          tag="net worth"
          rows={[
            { id:'A03', name:'Theo Vance',    v:fmtMoney(942_800_00), accent:'#95b876' },
            { id:'A01', name:'Mara Vex',      v:fmtMoney(187_400_00), accent:'#95b876' },
            { id:'A12', name:'Bram Halloran', v:fmtMoney(38_400_00),  accent:'#95b876' },
            { id:'A07', name:'Nico Reyes',    v:fmtMoney(28_400_00),  accent:'#cdb98a' },
          ]}
          onPick={onPick}
        />
        <Leaderboard
          title="Most Hated"
          tag="aggregated affinity"
          rows={[
            { id:'A01', name:'Mara Vex',  v:'−62', accent:'#e2536e' },
            { id:'A12', name:'Bram H.',   v:'−24', accent:'#e2536e' },
            { id:'A03', name:'Theo V.',   v:'−18', accent:'#e2536e' },
          ]}
          onPick={onPick}
        />
        <Leaderboard
          title="Most Followed"
          tag="active relationships"
          rows={[
            { id:'A04', name:'Cy Brennan',  v:'14', accent:'#9b7fd1' },
            { id:'A05', name:'Juno Park',   v:'12', accent:'#9b7fd1' },
            { id:'A07', name:'Nico Reyes',  v:'9',  accent:'#9b7fd1' },
          ]}
          onPick={onPick}
        />
      </div>
    </div>
  );
}

function renderEventBody(body, onPick) {
  return body.map((p, i) => {
    if (typeof p === 'string') return <span key={i}>{p}</span>;
    if (p.a) {
      const a = window.AGENT_BY_ID[p.a];
      return (
        <strong key={i}
          style={{ color:'#ffc26b', cursor:'pointer', textDecoration:'underline dotted', textUnderlineOffset: 2 }}
          onClick={() => onPick({ kind:'agent', id:p.a })}>
          {a?.name || p.a}
        </strong>
      );
    }
    if (p.b) {
      const b = window.BUILDING_BY_ID[p.b];
      return (
        <strong key={i}
          style={{ color:'#4ec5b8', cursor:'pointer', textDecoration:'underline dotted', textUnderlineOffset: 2 }}
          onClick={() => onPick({ kind:'building', id:p.b })}>
          {b?.name || p.b}
        </strong>
      );
    }
    return null;
  });
}

function Leaderboard({ title, tag, rows, onPick }) {
  return (
    <div style={{ padding:'10px 12px', borderBottom:'1px solid #2a2236' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6 }}>
        <span className="panel-title" style={{ color:'#ece6d3' }}>{title}</span>
        <span className="panel-tag">{tag}</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr auto', rowGap:3 }}>
        {rows.map((r, i) => (
          <React.Fragment key={r.id+i}>
            <span onClick={() => onPick({ kind:'agent', id:r.id })}
              style={{ cursor:'pointer', fontSize:12, color:'#ece6d3' }}>
              <span className="mono" style={{ color:'#5e5868', marginRight:6 }}>{String(i+1).padStart(2,'0')}</span>
              {r.name}
            </span>
            <span className="mono" style={{ fontSize:11, color: r.accent }}>{r.v}</span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ── BOTTOM BAR ───────────────────────────────────────────────────────────────
function BottomBar({ speed, setSpeed, paused, setPaused, heatMode, setHeatMode, dayPhase, tour, setTour }) {
  return (
    <div className="panel" style={{
      position:'absolute', left:16, right:380, bottom:16, height:52,
      display:'grid', gridTemplateColumns:'auto 1fr auto', gap:14, alignItems:'center', padding:'0 14px',
      zIndex: 20,
    }}>
      {/* speed control */}
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <span className="panel-title" style={{ marginRight: 8 }}>▌ SPEED</span>
        <button className="iconbtn" onClick={() => setPaused(p => !p)} title="pause">
          {paused ? '▶' : '❚❚'}
        </button>
        {[1,2,4,8].map(s => (
          <span key={s}
            className={`chip ${!paused && s === speed ? 'active' : ''}`}
            onClick={() => { setPaused(false); setSpeed(s); }}>
            {s}×
          </span>
        ))}
      </div>

      {/* heat filters */}
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <span className="panel-title" style={{ marginRight: 8 }}>▌ OVERLAYS</span>
        <span className={`chip ${heatMode==='none'?'active':''}`} onClick={() => setHeatMode('none')}>none</span>
        <span className={`chip ${heatMode==='crime'?'active':''}`} onClick={() => setHeatMode('crime')} style={heatMode==='crime'?{background:'#8e2738',borderColor:'#e2536e',color:'#ece6d3'}:{}}>crime heat</span>
        <span className={`chip ${heatMode==='wealth'?'active':''}`} onClick={() => setHeatMode('wealth')} style={heatMode==='wealth'?{background:'#4f7a3d',borderColor:'#95b876',color:'#ece6d3'}:{}}>wealth heat</span>
        <span className={`chip ${heatMode==='mood'?'active':''}`} onClick={() => setHeatMode('mood')} style={heatMode==='mood'?{background:'#1f7c75',borderColor:'#4ec5b8',color:'#ece6d3'}:{}}>sentiment</span>

        <span style={{ width:1, alignSelf:'stretch', background:'#2a2236', margin:'0 8px' }} />

        <span className={`chip ${tour?'active':''}`} onClick={() => setTour(t => !t)}>
          {tour ? '◉ tour mode' : '◌ tour mode'}
        </span>
      </div>

      {/* day/night minimap */}
      <DayNightStrip dayPhase={dayPhase} />
    </div>
  );
}

function DayNightStrip({ dayPhase }) {
  // colored bar showing dawn/day/dusk/night with a marker
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <span className="panel-title">▌ SUN</span>
      <div style={{ position:'relative', width:200, height:18, border:'1px solid #3a304a', background:'#0b0a10' }}>
        <div style={{ position:'absolute', inset:0,
          background:'linear-gradient(90deg, #1a2244 0%, #7a4030 18%, #c8a04a 30%, #ffc26b 50%, #c8a04a 70%, #b9522a 82%, #1a2244 100%)',
        }} />
        <div style={{
          position:'absolute', top:-3, bottom:-3,
          left: `${dayPhase * 100}%`,
          width: 3, background:'#ffc26b',
          boxShadow:'0 0 6px #ffc26b',
        }} />
      </div>
      <span className="mono" style={{ fontSize:10, color:'#8a8478', width:56 }}>{dayPhaseName(dayPhase)}</span>
    </div>
  );
}
function dayPhaseName(p) {
  if (p < 0.18) return 'night';
  if (p < 0.30) return 'dawn';
  if (p < 0.46) return 'morning';
  if (p < 0.56) return 'noon';
  if (p < 0.70) return 'afternoon';
  if (p < 0.84) return 'dusk';
  return 'night';
}

Object.assign(window, { TopBar, EventTicker, BottomBar, fmtMoney, fmtSimClock, fmtSimDate });
