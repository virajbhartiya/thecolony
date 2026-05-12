// TheColony — sprite primitives (inline SVG)
// All sprites use simple flat pixel-ish shapes drawn with rect/polygon.
// Coordinates: each iso tile is TILE_W × TILE_H (56 × 28) in screen space.

// world(tx,ty) → screen(x,y) for the tile center
function isoToScreen(tx, ty) {
  return {
    x: (tx - ty) * (window.TILE_W / 2),
    y: (tx + ty) * (window.TILE_H / 2),
  };
}

// ── TileDiamond: one ground tile diamond ─────────────────────────────────────
function TileDiamond({ tx, ty, fill, stroke = "#1a1820" }) {
  const { x, y } = isoToScreen(tx, ty);
  const w = window.TILE_W, h = window.TILE_H;
  // diamond points around (x,y)
  const pts = `${x},${y - h/2} ${x + w/2},${y} ${x},${y + h/2} ${x - w/2},${y}`;
  return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth="0.5" />;
}

// ── Building sprite ──────────────────────────────────────────────────────────
// Approximate footprint: w × h tiles starting at (x,y). We render a single
// big diamond base + an elevated block on top.
function BuildingSprite({ b, hovered, selected, lit, heat }) {
  const cx0 = (b.x - b.y) * (window.TILE_W / 2);
  const cy0 = (b.x + b.y) * (window.TILE_H / 2);
  // back-corner of footprint (tx+w, ty+h)
  const back = isoToScreen(b.x + b.w - 1, b.y + b.h - 1);
  // footprint extents in screen
  const fpW = (b.w + b.h) * (window.TILE_W / 2);
  const fpH = (b.w + b.h) * (window.TILE_H / 2);

  // building elevation (height of walls) depends on kind
  const ELEV = {
    factory: 70, bank: 60, town_hall: 92, court: 70, jail: 46,
    apartment: 96, house: 38, house_big: 56, shop: 38, office: 70,
    bar: 42, cafe: 38, water_works: 52, power_plant: 88, park: 0,
  }[b.kind] || 50;

  // center of footprint
  const cx = (cx0 + back.x) / 2;
  const cy = (cy0 + back.y) / 2;

  // footprint diamond
  const fpTop    = { x: cx, y: cy - fpH/2 };
  const fpRight  = { x: cx + fpW/2, y: cy };
  const fpBot    = { x: cx, y: cy + fpH/2 };
  const fpLeft   = { x: cx - fpW/2, y: cy };

  const elev = ELEV;
  const top = { top: {x:fpTop.x,y:fpTop.y-elev}, right:{x:fpRight.x,y:fpRight.y-elev},
                bot: {x:fpBot.x,y:fpBot.y-elev}, left:{x:fpLeft.x,y:fpLeft.y-elev} };

  // tints for heat overlay
  const heatTint = heat?.color;
  const heatA = heat?.alpha ?? 0;

  // door & window placement on right (sunny) wall
  const rightWall = [
    `${fpRight.x},${fpRight.y}`,
    `${fpBot.x},${fpBot.y}`,
    `${top.bot.x},${top.bot.y}`,
    `${top.right.x},${top.right.y}`,
  ].join(' ');
  const leftWall = [
    `${fpLeft.x},${fpLeft.y}`,
    `${fpBot.x},${fpBot.y}`,
    `${top.bot.x},${top.bot.y}`,
    `${top.left.x},${top.left.y}`,
  ].join(' ');
  const roof = [
    `${top.top.x},${top.top.y}`,
    `${top.right.x},${top.right.y}`,
    `${top.bot.x},${top.bot.y}`,
    `${top.left.x},${top.left.y}`,
  ].join(' ');

  // park = green diamond + a tree
  if (b.kind === 'park') {
    return (
      <g>
        <polygon points={`${fpTop.x},${fpTop.y} ${fpRight.x},${fpRight.y} ${fpBot.x},${fpBot.y} ${fpLeft.x},${fpLeft.y}`} fill="#4f7a3d" stroke="#2a3a20" />
        {/* tree */}
        <ellipse cx={cx} cy={cy - 18} rx="14" ry="16" fill="#3a5530" stroke="#1a2a14" />
        <ellipse cx={cx + 4} cy={cy - 22} rx="10" ry="12" fill="#5b7a45" />
        <rect x={cx - 2} y={cy - 6} width="4" height="8" fill="#4a3320" />
        {/* bell tower */}
        <rect x={cx - 18} y={cy - 36} width="8" height="28" fill="#7a6a52" stroke="#3a2f24" />
        <polygon points={`${cx-22},${cy-36} ${cx-14},${cy-44} ${cx-6},${cy-36}`} fill="#b9722a" stroke="#3a2f24" />
        <rect x={cx - 17} y={cy - 28} width="6" height="6" fill="#1c1925" />
      </g>
    );
  }

  // door rect on the right wall, centered along the wall axis
  const doorCx = (fpRight.x + fpBot.x) / 2;
  const doorCy = (fpRight.y + fpBot.y) / 2;
  const doorW = 9, doorH = 16;

  // windows — generate a grid of small rects across the right wall
  const windows = [];
  const wRowCount = Math.max(1, Math.floor(elev / 18));
  const wColCount = Math.max(1, Math.min(b.w + b.h, 4));
  for (let r = 0; r < wRowCount; r++) {
    for (let c = 0; c < wColCount; c++) {
      const fx = (c + 1) / (wColCount + 1);  // along right wall (top→bot)
      const fy = (r + 0.5) / wRowCount;       // up the wall
      // along right wall vector (fpRight → fpBot)
      const wx = fpRight.x + (fpBot.x - fpRight.x) * fx;
      const wy = fpRight.y + (fpBot.y - fpRight.y) * fx;
      // up wall
      const py = wy - (1 - fy) * elev - 4;
      windows.push({ x: wx - 3, y: py - 4, w: 6, h: 6 });
    }
  }

  return (
    <g style={{ cursor:'pointer' }}>
      {/* heat halo on the ground */}
      {heatTint && heatA > 0 && (
        <polygon
          points={`${fpTop.x},${fpTop.y} ${fpRight.x},${fpRight.y} ${fpBot.x},${fpBot.y} ${fpLeft.x},${fpLeft.y}`}
          fill={heatTint} opacity={heatA} />
      )}
      {/* foundation diamond */}
      <polygon
        points={`${fpTop.x},${fpTop.y} ${fpRight.x},${fpRight.y} ${fpBot.x},${fpBot.y} ${fpLeft.x},${fpLeft.y}`}
        fill="#2a2230" stroke="#0b0a10" strokeWidth="1" />
      {/* left wall (shadow side) */}
      <polygon points={leftWall} fill={shade(b.wall, -0.28)} stroke="#0b0a10" strokeWidth="1" />
      {/* right wall (sun side) */}
      <polygon points={rightWall} fill={b.wall} stroke="#0b0a10" strokeWidth="1" />
      {/* roof */}
      <polygon points={roof} fill={b.roof} stroke="#0b0a10" strokeWidth="1" />
      {/* roof accent line */}
      <line x1={top.left.x} y1={top.left.y} x2={top.right.x} y2={top.right.y} stroke={shade(b.roof, 0.25)} strokeWidth="1" />

      {/* door on right wall */}
      <rect x={doorCx - doorW/2} y={doorCy - doorH} width={doorW} height={doorH} fill={shade(b.wall, -0.5)} stroke="#0b0a10" />
      <rect x={doorCx - 1} y={doorCy - doorH/2 - 1} width="1.5" height="1.5" fill={b.accent} />

      {/* windows */}
      {windows.map((w, i) => (
        <rect key={i} x={w.x} y={w.y} width={w.w} height={w.h}
              fill={lit ? '#ffd58a' : shade(b.wall, -0.55)}
              stroke="#0b0a10" />
      ))}

      {/* kind-specific roof ornament */}
      {b.kind === 'town_hall' && (
        <>
          <ellipse cx={(top.top.x+top.bot.x)/2} cy={(top.top.y+top.bot.y)/2 - 14} rx="10" ry="6" fill="#b9722a" stroke="#0b0a10" />
          <rect x={(top.top.x+top.bot.x)/2 - 1} y={(top.top.y+top.bot.y)/2 - 24} width="2" height="10" fill="#ffc26b" />
        </>
      )}
      {b.kind === 'bank' && (
        <rect x={(top.top.x+top.bot.x)/2 - 12} y={(top.top.y+top.bot.y)/2 - 6} width="24" height="4" fill="#cdb98a" stroke="#0b0a10" />
      )}
      {b.kind === 'factory' && (
        <>
          <rect x={top.left.x + 8} y={top.left.y - 30} width="6" height="30" fill={shade(b.wall, -0.4)} stroke="#0b0a10" />
          <rect x={top.left.x + 7} y={top.left.y - 34} width="8" height="4" fill={b.accent} stroke="#0b0a10" />
        </>
      )}
      {b.kind === 'power_plant' && (
        <>
          <rect x={top.right.x - 14} y={top.right.y - 36} width="6" height="36" fill={shade(b.wall, -0.4)} stroke="#0b0a10" />
          <circle cx={top.right.x - 11} cy={top.right.y - 38} r="3" fill="#4ec5b8" className="pulse" />
        </>
      )}
      {b.kind === 'court' && (
        <>
          <polygon points={`${top.left.x+6},${top.left.y} ${(top.left.x+top.right.x)/2},${(top.left.y+top.right.y)/2 - 14} ${top.right.x-6},${top.right.y}`} fill={shade(b.roof,0.15)} stroke="#0b0a10" />
        </>
      )}
      {b.kind === 'jail' && (
        <g stroke="#0b0a10">
          {[0.2,0.4,0.6,0.8].map((f,i) => {
            const wx = fpRight.x + (fpBot.x - fpRight.x) * f;
            const wy = fpRight.y + (fpBot.y - fpRight.y) * f;
            return <line key={i} x1={wx} y1={wy - elev + 6} x2={wx} y2={wy - 4} stroke="#0b0a10" />;
          })}
        </g>
      )}

      {/* selection / hover ring */}
      {(hovered || selected) && (
        <polygon
          points={`${fpTop.x},${fpTop.y} ${fpRight.x},${fpRight.y} ${fpBot.x},${fpBot.y} ${fpLeft.x},${fpLeft.y}`}
          fill="none" stroke={selected ? '#ffc26b' : '#f0a347'} strokeWidth="2" strokeDasharray={selected ? '0' : '3 2'} />
      )}

      {/* invisible click rect across whole sprite */}
      <polygon
        points={`${fpTop.x},${fpTop.y - elev} ${fpRight.x},${fpRight.y - elev} ${fpRight.x},${fpRight.y} ${fpBot.x},${fpBot.y} ${fpLeft.x},${fpLeft.y} ${fpLeft.x},${fpLeft.y - elev}`}
        fill="transparent" />
    </g>
  );
}

// ── Agent sprite ─────────────────────────────────────────────────────────────
function AgentSprite({ a, x, y, walking, selected, hovered, heat }) {
  // small bob if walking
  const bob = walking ? Math.sin(performance.now() / 110 + (a.id.charCodeAt(1) || 0)) * 1 : 0;
  const yy = y + bob;

  // simple 10x16 character: head 4x4 + body 6x8 + legs
  return (
    <g style={{ cursor:'pointer' }}>
      {/* shadow */}
      <ellipse cx={x} cy={y + 1} rx="6" ry="2" fill="#000" opacity="0.45" />
      {/* legs */}
      <rect x={x-3} y={yy-6} width="2" height="6" fill={a.pants} />
      <rect x={x+1} y={yy-6} width="2" height="6" fill={a.pants} />
      {/* body */}
      <rect x={x-3} y={yy-12} width="6" height="6" fill={a.shirt} stroke="#0b0a10" strokeWidth="0.5" />
      {/* head */}
      <rect x={x-2} y={yy-16} width="4" height="4" fill={a.skin} stroke="#0b0a10" strokeWidth="0.5" />
      {/* hair */}
      <rect x={x-2} y={yy-17} width="4" height="2" fill={a.hair} />
      {/* eye dots */}
      <rect x={x-1} y={yy-15} width="1" height="1" fill="#0b0a10" />
      <rect x={x+1} y={yy-15} width="1" height="1" fill="#0b0a10" />

      {/* heat dot */}
      {heat?.color && (
        <circle cx={x} cy={yy - 20} r="2.5" fill={heat.color} opacity={heat.alpha ?? 0.9} />
      )}
      {/* warrant ! */}
      {a.flags?.includes('wanted') && (
        <g>
          <rect x={x+5} y={yy-20} width="6" height="6" fill="#e2536e" stroke="#0b0a10" />
          <rect x={x+7} y={yy-19} width="2" height="2" fill="#fff" />
          <rect x={x+7} y={yy-16} width="2" height="1" fill="#fff" />
        </g>
      )}

      {/* selection ring */}
      {(selected || hovered) && (
        <circle cx={x} cy={yy - 8} r="12" fill="none" stroke={selected ? '#ffc26b' : '#f0a347'} strokeWidth="1.5" strokeDasharray={selected ? '0' : '2 2'} />
      )}
    </g>
  );
}

// ── Portrait (for drawer) ────────────────────────────────────────────────────
function Portrait({ a, size = 84 }) {
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 32 32" style={{ imageRendering:'pixelated', background:'#1c1925', border:'1px solid #3a304a' }}>
      {/* background gradient */}
      <defs>
        <linearGradient id={`pg-${a.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a2236" />
          <stop offset="1" stopColor="#0b0a10" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="32" height="32" fill={`url(#pg-${a.id})`} />
      {/* shoulders */}
      <rect x="6" y="22" width="20" height="10" fill={a.shirt} />
      <rect x="7" y="24" width="18" height="1" fill="#0b0a10" opacity="0.4" />
      {/* neck */}
      <rect x="14" y="18" width="4" height="4" fill={a.skin} />
      {/* face */}
      <rect x="10" y="10" width="12" height="10" fill={a.skin} />
      {/* hair */}
      <rect x="9" y="8" width="14" height="4" fill={a.hair} />
      <rect x="9" y="12" width="2" height="3" fill={a.hair} />
      <rect x="21" y="12" width="2" height="3" fill={a.hair} />
      {/* eyes */}
      <rect x="12" y="14" width="2" height="2" fill="#0b0a10" />
      <rect x="18" y="14" width="2" height="2" fill="#0b0a10" />
      {/* mouth */}
      <rect x="13" y="18" width="6" height="1" fill="#0b0a10" />
      {/* highlight */}
      <rect x="11" y="11" width="1" height="1" fill="#fff" opacity="0.25" />
    </svg>
  );
}

// ── color shade helper ───────────────────────────────────────────────────────
function shade(hex, amt) {
  const h = hex.replace('#','');
  const r = parseInt(h.slice(0,2),16);
  const g = parseInt(h.slice(2,4),16);
  const b = parseInt(h.slice(4,6),16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (amt > 0 ? (255-c)*amt : c*amt))));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

Object.assign(window, { isoToScreen, TileDiamond, BuildingSprite, AgentSprite, Portrait, shade });
