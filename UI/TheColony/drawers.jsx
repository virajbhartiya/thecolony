// TheColony — drawer (Agent + Building dossiers)

function Drawer({ selected, onClose, onPick, follow, setFollow, agents }) {
  if (!selected) return null;
  const liveAgent = selected.kind === 'agent' ? agents.find(a => a.id === selected.id) : null;

  return (
    <div className="drawer">
      {/* HEADER */}
      <div className="panel-header" style={{ background: selected.kind === 'agent' ? 'linear-gradient(180deg, rgba(240,163,71,0.10), transparent)' : 'linear-gradient(180deg, rgba(78,197,184,0.10), transparent)' }}>
        <span className="panel-title">
          {selected.kind === 'agent' ? '▌ AGENT DOSSIER' : '▌ BUILDING RECORD'}
        </span>
        <div style={{ display:'flex', gap:6 }}>
          {selected.kind === 'agent' && (
            <button
              className="iconbtn"
              title="Follow camera"
              onClick={() => setFollow(follow === selected.id ? null : selected.id)}
              style={follow === selected.id ? { background:'#b9722a', color:'#0b0a10' } : {}}
            >F</button>
          )}
          <button className="iconbtn" onClick={onClose} title="close">×</button>
        </div>
      </div>

      <div className="drawer-scroll">
        {selected.kind === 'agent' && <AgentDossier agent={window.AGENT_BY_ID[selected.id]} liveAgent={liveAgent} onPick={onPick} />}
        {selected.kind === 'building' && <BuildingRecord b={window.BUILDING_BY_ID[selected.id]} onPick={onPick} />}
      </div>
    </div>
  );
}

// ── AGENT DOSSIER ────────────────────────────────────────────────────────────
function AgentDossier({ agent, liveAgent, onPick }) {
  if (!agent) return null;
  const a = agent;
  const rels = window.RELATIONSHIPS[a.id] || synthRelationships(a.id);

  const needs = liveAgent?.needs || { hunger: 28, energy: 62, social: 41, money_anxiety: 71, life_satisfaction: 36 };
  const state = liveAgent?.state || 'walking';
  const where = liveAgent ? nearestPlace(liveAgent.pos) : 'unknown';

  const statusClass = {
    alive: 'alive', dead: 'dead', jailed: 'jailed', bankrupt: 'bankrupt',
  }[a.status] || 'alive';

  return (
    <>
      {/* identity */}
      <div className="drawer-section" style={{ display:'flex', gap:14 }}>
        <Portrait a={a} size={84} />
        <div style={{ flex:1, minWidth:0 }}>
          <div className="pixel" style={{ fontSize:16, color:'#ffc26b', letterSpacing:'0.08em', lineHeight:1.1 }}>{a.name}</div>
          <div className="mono" style={{ fontSize:10, color:'#8a8478', marginTop:4 }}>ID {a.id} · AGE {a.age} · {a.id.endsWith('1')||a.id.endsWith('3')||a.id.endsWith('5')||a.id.endsWith('7')||a.id.endsWith('9')?'M':'F'}</div>
          <div style={{ fontSize:12, color:'#ece6d3', marginTop:6 }}>{a.occ}</div>
          <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
            <span className={`pill ${statusClass}`}>{a.status}</span>
            {a.flags?.map(f => (
              <span key={f} className="pill" style={{ color: f==='wanted' || f==='debt_critical' ? '#e2536e' : '#9b7fd1' }}>{f.replace(/_/g,' ')}</span>
            ))}
          </div>
        </div>
      </div>

      {/* current state + balance */}
      <div className="drawer-section">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <Stat label="Balance" value={fmtMoney(a.balance)} accent={a.balance < 0 ? '#e2536e' : '#95b876'} />
          <Stat label="State" value={state.toUpperCase()} accent="#ffc26b" mono />
          <Stat label="Mood" value={`${a.mood >= 0 ? '+' : ''}${a.mood}`} accent={a.mood < 0 ? '#e2536e' : '#95b876'} mono />
          <Stat label="Located" value={where} mono />
        </div>
      </div>

      {/* needs bars */}
      <div className="drawer-section">
        <h4>Needs</h4>
        {[
          ['hunger', needs.hunger, '#e2536e'],
          ['energy', needs.energy, '#95b876'],
          ['social', needs.social, '#9b7fd1'],
          ['money_anxiety', needs.money_anxiety, '#ffc26b'],
          ['life_satisfaction', needs.life_satisfaction, '#4ec5b8'],
        ].map(([k, v, c]) => (
          <div key={k} style={{ display:'grid', gridTemplateColumns:'110px 1fr 28px', gap:8, marginBottom:5, alignItems:'center' }}>
            <span className="mono" style={{ fontSize:10, color:'#8a8478' }}>{k}</span>
            <div className="bar"><i style={{ width:`${v}%`, background:c }} /></div>
            <span className="mono" style={{ fontSize:10, color:'#ece6d3', textAlign:'right' }}>{v}</span>
          </div>
        ))}
      </div>

      {/* traits */}
      <div className="drawer-section">
        <h4>Traits</h4>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          {Object.entries(a.traits).map(([k, v]) => (
            <div key={k} style={{ display:'grid', gridTemplateColumns:'78px 1fr', gap:6, alignItems:'center' }}>
              <span className="mono" style={{ fontSize:10, color:'#8a8478' }}>{k}</span>
              <div className="bar"><i style={{ width:`${v*100}%`, background:'#cdb98a' }} /></div>
            </div>
          ))}
        </div>
      </div>

      {/* ideology */}
      <div className="drawer-section">
        <h4>Ideology</h4>
        <div style={{ fontSize:12, color:'#cdb98a', lineHeight:1.4, fontStyle:'italic' }}>"{a.ideology}"</div>
      </div>

      {/* bio */}
      <div className="drawer-section">
        <h4>Origin</h4>
        <div style={{ fontSize:12, color:'#ece6d3', lineHeight:1.45 }}>{a.bio}</div>
      </div>

      {/* relationships */}
      <div className="drawer-section">
        <h4>Top relationships</h4>
        {rels.slice(0, 5).map((r,i) => {
          const o = window.AGENT_BY_ID[r.other];
          if (!o) return null;
          return (
            <div key={i} style={{
              display:'grid', gridTemplateColumns:'1fr auto auto', gap:8, alignItems:'center',
              padding:'6px 0', borderBottom:'1px dashed #2a2236', cursor:'pointer',
            }} onClick={() => onPick({ kind:'agent', id:r.other })}>
              <div>
                <div style={{ fontSize:12, color:'#ece6d3' }}>{o.name}</div>
                <div className="mono" style={{ fontSize:9, color:'#8a8478' }}>{(r.tags||[]).join(' · ')}</div>
              </div>
              <AffinityChip label="aff"   v={r.affinity} />
              <AffinityChip label="trust" v={r.trust} />
            </div>
          );
        })}
      </div>

      {/* recent memories */}
      <div className="drawer-section">
        <h4>Recent memories</h4>
        {SAMPLE_MEMORIES(a.id).map((m,i) => (
          <div key={i} style={{
            background:'#1c1925',
            border:'1px solid #2a2236', borderLeft: `3px solid ${m.color}`,
            padding:'8px 10px', marginBottom:6,
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
              <span className="pixel" style={{ fontSize:9, color:'#8a8478', letterSpacing:'0.16em' }}>{m.kind.toUpperCase()}</span>
              <span className="mono" style={{ fontSize:9, color:'#5e5868' }}>{m.t} · sal {m.sal.toFixed(2)}</span>
            </div>
            <div style={{ fontSize:12, color:'#ece6d3', lineHeight:1.4 }}>{m.body}</div>
          </div>
        ))}
      </div>

      {/* holdings */}
      <div className="drawer-section">
        <h4>Holdings</h4>
        <div className="mono" style={{ fontSize:11, color:'#cdb98a' }}>
          {SAMPLE_HOLDINGS(a.id).map((h,i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0' }}>
              <span>{h.label}</span>
              <span style={{ color: h.value.startsWith('-') ? '#e2536e' : '#ece6d3' }}>{h.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* reputation distribution mini chart */}
      <div className="drawer-section">
        <h4>Reputation distribution</h4>
        <ReputationHistogram agent={a} />
      </div>
    </>
  );
}

function Stat({ label, value, accent, mono }) {
  return (
    <div style={{ border:'1px solid #2a2236', padding:'6px 8px', background:'#1c1925' }}>
      <div className="pixel" style={{ fontSize:9, color:'#8a8478', letterSpacing:'0.18em' }}>{label.toUpperCase()}</div>
      <div className={mono ? 'mono' : ''} style={{ fontSize:14, color: accent || '#ece6d3', marginTop:2 }}>{value}</div>
    </div>
  );
}

function AffinityChip({ label, v }) {
  const color = v >= 30 ? '#95b876' : v <= -30 ? '#e2536e' : '#cdb98a';
  return (
    <div style={{ minWidth:48, textAlign:'right' }}>
      <div className="pixel" style={{ fontSize:8, color:'#5e5868', letterSpacing:'0.18em' }}>{label.toUpperCase()}</div>
      <div className="mono" style={{ fontSize:11, color }}>{v > 0 ? '+' : ''}{v}</div>
    </div>
  );
}

function ReputationHistogram({ agent }) {
  // 7 buckets from -100 to +100, fake plausible distribution biased by mood
  const buckets = [3, 5, 8, 12, 9, 4, 1];
  // shift bias toward bad if mood < 0
  if (agent.mood < 0) buckets.reverse();
  const max = Math.max(...buckets);
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:3, alignItems:'end', height:46 }}>
      {buckets.map((b,i) => {
        const isNeg = i < 3;
        return (
          <div key={i} style={{
            background: isNeg ? '#e2536e' : (i===3?'#cdb98a':'#95b876'),
            height: `${(b/max)*100}%`,
            border:'1px solid #0b0a10',
          }} />
        );
      })}
      <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'space-between' }}>
        <span className="mono" style={{ fontSize:9, color:'#5e5868' }}>−100</span>
        <span className="mono" style={{ fontSize:9, color:'#5e5868' }}>0</span>
        <span className="mono" style={{ fontSize:9, color:'#5e5868' }}>+100</span>
      </div>
    </div>
  );
}

// ── BUILDING RECORD ──────────────────────────────────────────────────────────
function BuildingRecord({ b, onPick }) {
  if (!b) return null;
  const owner = b.owner === 'CITY' ? null : window.AGENT_BY_ID[b.owner];
  const employees = b.employees.map(id => window.AGENT_BY_ID[id]).filter(Boolean);

  return (
    <>
      <div className="drawer-section" style={{ display:'flex', gap:14 }}>
        <BuildingThumb b={b} />
        <div style={{ flex:1 }}>
          <div className="pixel" style={{ fontSize:16, color:'#4ec5b8', letterSpacing:'0.06em', lineHeight:1.1 }}>{b.name}</div>
          <div className="mono" style={{ fontSize:10, color:'#8a8478', marginTop:4 }}>ID {b.id} · TILE ({b.x}, {b.y}) · {b.w}×{b.h}</div>
          <div style={{ fontSize:12, color:'#cdb98a', marginTop:6, lineHeight:1.45, fontStyle:'italic' }}>{b.desc}</div>
          <div style={{ display:'flex', gap:6, marginTop:8 }}>
            <span className="pill" style={{ color:'#cdb98a' }}>{b.kind.replace(/_/g,' ')}</span>
            {b.owner === 'CITY' ? <span className="pill" style={{ color:'#9b7fd1' }}>civic</span> : <span className="pill" style={{ color:'#95b876' }}>private</span>}
          </div>
        </div>
      </div>

      <div className="drawer-section">
        <h4>Stats</h4>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <Stat label="Owner" value={owner?.name || 'City of Colony'} />
          <Stat label="Condition" value="78 / 100" accent="#95b876" mono />
          <Stat label="Capacity" value={String((b.w * b.h) * 4)} mono />
          <Stat label="Rent/day" value={fmtMoney((b.w*b.h)*120_00)} accent="#cdb98a" />
        </div>
      </div>

      {b.owner !== 'CITY' && owner && (
        <div className="drawer-section">
          <h4>Owner</h4>
          <div style={{ display:'flex', gap:10, alignItems:'center', cursor:'pointer' }} onClick={() => onPick({ kind:'agent', id:owner.id })}>
            <Portrait a={owner} size={42} />
            <div>
              <div style={{ fontSize:13, color:'#ece6d3' }}>{owner.name}</div>
              <div className="mono" style={{ fontSize:10, color:'#8a8478' }}>{owner.occ}</div>
            </div>
          </div>
        </div>
      )}

      <div className="drawer-section">
        <h4>{employees.length ? `Employees · ${employees.length}` : 'No employees'}</h4>
        {employees.map(e => (
          <div key={e.id}
            onClick={() => onPick({ kind:'agent', id:e.id })}
            style={{ display:'grid', gridTemplateColumns:'auto 1fr auto', gap:10, alignItems:'center',
                     padding:'6px 0', borderBottom:'1px dashed #2a2236', cursor:'pointer' }}>
            <div style={{ width:26, height:26, background:e.shirt, border:'1px solid #0b0a10' }} />
            <div>
              <div style={{ fontSize:12, color:'#ece6d3' }}>{e.name}</div>
              <div className="mono" style={{ fontSize:9, color:'#8a8478' }}>{e.occ}</div>
            </div>
            <span className="mono" style={{ fontSize:10, color:'#cdb98a' }}>{fmtMoney(e.balance)}</span>
          </div>
        ))}
      </div>

      <div className="drawer-section">
        <h4>Recent transactions</h4>
        {SAMPLE_TXNS(b.id).map((t, i) => (
          <div key={i} className="mono" style={{
            display:'grid', gridTemplateColumns:'48px 1fr auto', gap:8,
            fontSize:11, color:'#cdb98a', padding:'3px 0', borderBottom:'1px dashed #2a2236',
          }}>
            <span style={{ color:'#5e5868' }}>{t.t}</span>
            <span>{t.reason}</span>
            <span style={{ color: t.amount.startsWith('-') ? '#e2536e' : '#95b876' }}>{t.amount}</span>
          </div>
        ))}
      </div>

      <div className="drawer-section">
        <h4>Inventory</h4>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
          {SAMPLE_INVENTORY(b.kind).map(it => (
            <div key={it.k} style={{ border:'1px solid #2a2236', padding:'6px 8px', background:'#1c1925' }}>
              <div className="pixel" style={{ fontSize:9, color:'#8a8478', letterSpacing:'0.18em' }}>{it.k.toUpperCase()}</div>
              <div className="mono" style={{ fontSize:13, color:'#ece6d3' }}>{it.qty}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function BuildingThumb({ b }) {
  return (
    <svg width="84" height="84" viewBox="-50 -50 100 100" style={{ background:'#1c1925', border:'1px solid #3a304a' }}>
      <BuildingSprite b={{...b, x:0, y:0}} lit={true} />
    </svg>
  );
}

// ── sample data generators for live-feel content ────────────────────────────
function synthRelationships(id) {
  const others = window.AGENTS.filter(a => a.id !== id).slice(0, 4);
  return others.map((o, i) => ({
    other: o.id,
    affinity: (id.charCodeAt(1) * 7 + i * 13) % 120 - 60,
    trust:    (id.charCodeAt(2) * 5 + i * 11) % 120 - 60,
    tags:['acquaintance'],
  }));
}

function SAMPLE_MEMORIES(id) {
  const M = {
    A01: [
      { kind:'event',     t:'09:14', sal:0.92, color:'#e2536e', body:'Fired four. Rook was the loud one. He will be back. Tell Sasha to watch the gate tonight.' },
      { kind:'reflection',t:'08:51', sal:0.71, color:'#9b7fd1', body:'The cannery margin shrinks every quarter. Theo will not lend without collateral I cannot give him.' },
      { kind:'belief',    t:'D411',  sal:0.85, color:'#cdb98a', body:'Workers who organize will not stop until something breaks. Pick the something.' },
      { kind:'event',     t:'07:30', sal:0.40, color:'#ffc26b', body:'Lin tried to plead. I did not look up from the ledger.' },
    ],
    A02: [
      { kind:'event',     t:'09:14', sal:0.98, color:'#e2536e', body:'Fired. No notice. No pay for the half-week. The girls do not know yet.' },
      { kind:'rumor',     t:'D410',  sal:0.62, color:'#9b7fd1', body:'Juno says Rook has been talking strike. I believe him.' },
      { kind:'reflection',t:'D408',  sal:0.55, color:'#cdb98a', body:'I trusted Mara for eight years. That was the mistake I am paying for now.' },
    ],
    A04: [
      { kind:'belief',    t:'D405',  sal:0.94, color:'#cdb98a', body:'The Dust does not lie. The bell knows. The bell knows.' },
      { kind:'event',     t:'09:34', sal:0.66, color:'#ffc26b', body:'Six listeners today. Wren stayed for the whole sermon. She did not steal.' },
      { kind:'reflection',t:'D408',  sal:0.71, color:'#9b7fd1', body:'I must speak louder this week. Otto will not last another month and the city will not notice.' },
    ],
  };
  return M[id] || [
    { kind:'event',     t:'09:04', sal:0.42, color:'#cdb98a', body:'Walked from home to the square. Nothing happened. I noticed the dog at the bell.' },
    { kind:'reflection',t:'D411',  sal:0.31, color:'#9b7fd1', body:'I do not know what I want from this week.' },
  ];
}

function SAMPLE_HOLDINGS(id) {
  const H = {
    A01: [
      { label:'Riverside Foods · 100% owner',     value:'private' },
      { label:'Eastside Bank · 220 shares',        value:'$44,000' },
      { label:'Vance Manor · 1/4 lease',           value:'−$1,200 / mo' },
    ],
    A02: [
      { label:'Pier Apartments · unit 4D',         value:'$420 / mo' },
      { label:'Tidewater Power · 12 shares',       value:'$96' },
    ],
    A03: [
      { label:'Eastside Bank · 80% owner',         value:'private' },
      { label:'Marrow & Oak · 100%',               value:'private' },
      { label:'Vance Manor · 100%',                value:'private' },
      { label:'Hollow Mill · 410 shares',          value:'$18,040' },
    ],
    A04: [
      { label:'Dust House · 1/4 lease',            value:'−$60 / mo' },
    ],
  };
  return H[id] || [{ label:'No declared holdings', value:'—' }];
}

function SAMPLE_TXNS(bId) {
  const T = {
    B01: [
      { t:'09:14', reason:'wages (4 termed)',    amount:'-$1,840' },
      { t:'09:02', reason:'food → market',        amount:'+$3,200' },
      { t:'08:30', reason:'tool repair',          amount:'-$240' },
      { t:'08:00', reason:'cloth purchase',       amount:'-$520' },
    ],
    B07: [
      { t:'09:22', reason:'loan to A07',          amount:'-$12,000' },
      { t:'09:11', reason:'deposit (A03)',        amount:'+$4,800' },
      { t:'08:54', reason:'interest accrual',     amount:'+$320' },
    ],
    B14: [
      { t:'09:40', reason:'whiskey × 4',          amount:'+$32' },
      { t:'09:22', reason:'tab opened (A10)',     amount:'+$0' },
      { t:'08:58', reason:'piano tuning (sigh)',  amount:'-$80' },
    ],
  };
  return T[bId] || [
    { t:'09:14', reason:'operations',           amount:'+$420' },
    { t:'08:52', reason:'upkeep',               amount:'-$120' },
    { t:'08:30', reason:'wages',                amount:'-$340' },
  ];
}

function SAMPLE_INVENTORY(kind) {
  const M = {
    factory:    [{k:'food',qty:420},{k:'cloth',qty:80},{k:'tool',qty:12}],
    bank:       [{k:'cash',qty:842000},{k:'contracts',qty:48},{k:'liens',qty:12}],
    bar:        [{k:'whiskey',qty:34},{k:'beer',qty:120},{k:'food',qty:8}],
    shop:       [{k:'food',qty:140},{k:'cloth',qty:32},{k:'tool',qty:9}],
    apartment:  [{k:'units',qty:18},{k:'occupied',qty:14},{k:'leaks',qty:3}],
    house:      [{k:'rooms',qty:2},{k:'stove',qty:1},{k:'tools',qty:2}],
    house_big:  [{k:'rooms',qty:9},{k:'staff',qty:3},{k:'wine',qty:84}],
    office:     [{k:'desks',qty:6},{k:'files',qty:412},{k:'ink',qty:18}],
    cafe:       [{k:'coffee',qty:24},{k:'pastry',qty:18},{k:'sugar',qty:4}],
    water_works:[{k:'water',qty:9800},{k:'filters',qty:12},{k:'pipes',qty:74}],
    power_plant:[{k:'energy',qty:4800},{k:'coal',qty:2200},{k:'oil',qty:140}],
    town_hall:  [{k:'records',qty:1840},{k:'seats',qty:7},{k:'bells',qty:1}],
    court:      [{k:'cases',qty:42},{k:'gavels',qty:2},{k:'oaths',qty:'∞'}],
    jail:       [{k:'cells',qty:6},{k:'occupied',qty:2},{k:'keys',qty:3}],
    park:       [{k:'benches',qty:2},{k:'trees',qty:6},{k:'crows',qty:'?'}],
  };
  return M[kind] || [{k:'misc',qty:0}];
}

function nearestPlace(pos) {
  let best = null, bestD = 1e9;
  for (const b of window.BUILDINGS) {
    const cx = b.x + b.w/2, cy = b.y + b.h/2;
    const d = (cx - pos.tx)**2 + (cy - pos.ty)**2;
    if (d < bestD) { bestD = d; best = b; }
  }
  return best ? best.name : 'open street';
}

Object.assign(window, { Drawer });
