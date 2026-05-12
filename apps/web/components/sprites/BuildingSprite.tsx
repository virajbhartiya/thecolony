'use client';
import { TILE_W, TILE_H, tileToWorld } from '../../lib/iso';
import { buildingPalette, shade } from '../../lib/sprite-helpers';

export interface BuildingSpriteData {
  id: string;
  kind: string;
  name: string;
  tile_x: number;
  tile_y: number;
  tile_w: number;
  tile_h: number;
}

interface Props {
  b: BuildingSpriteData;
  hovered?: boolean;
  selected?: boolean;
  lit?: boolean;
  heat?: { color: string; alpha: number } | null;
  onClick?: () => void;
  onHover?: (h: boolean) => void;
}

function variant(id: string): { roofTint: number; wallTint: number; sign: number } {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  const a = ((h >>> 0) % 1000) / 1000;
  const b = ((h >>> 10) % 1000) / 1000;
  const c = ((h >>> 20) % 1000) / 1000;
  return { roofTint: (a - 0.5) * 0.18, wallTint: (b - 0.5) * 0.12, sign: c };
}

interface RoofGeom {
  top: { x: number; y: number };
  right: { x: number; y: number };
  bot: { x: number; y: number };
  left: { x: number; y: number };
}

export default function BuildingSprite({ b, hovered, selected, lit, heat, onClick, onHover }: Props) {
  const palette = buildingPalette(b.kind);
  const v = variant(b.id);
  const w = b.tile_w;
  const h = b.tile_h;
  const elev = palette.elev;
  const roofColor = shade(palette.roof, v.roofTint);
  const wallColor = shade(palette.wall, v.wallTint);

  const cx0 = (b.tile_x - b.tile_y) * (TILE_W / 2);
  const cy0 = (b.tile_x + b.tile_y) * (TILE_H / 2);
  const back = tileToWorld(b.tile_x + w - 1, b.tile_y + h - 1);
  const fpW = (w + h) * (TILE_W / 2);
  const fpH = (w + h) * (TILE_H / 2);
  const cx = (cx0 + back.x) / 2;
  const cy = (cy0 + back.y) / 2;

  const fpTop = { x: cx, y: cy - fpH / 2 };
  const fpRight = { x: cx + fpW / 2, y: cy };
  const fpBot = { x: cx, y: cy + fpH / 2 };
  const fpLeft = { x: cx - fpW / 2, y: cy };

  const top: RoofGeom = {
    top: { x: fpTop.x, y: fpTop.y - elev },
    right: { x: fpRight.x, y: fpRight.y - elev },
    bot: { x: fpBot.x, y: fpBot.y - elev },
    left: { x: fpLeft.x, y: fpLeft.y - elev },
  };

  if (b.kind === 'park') {
    return (
      <g
        style={{ cursor: 'pointer' }}
        onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        onPointerEnter={() => onHover?.(true)}
        onPointerLeave={() => onHover?.(false)}
      >
        <polygon
          points={`${fpTop.x},${fpTop.y} ${fpRight.x},${fpRight.y} ${fpBot.x},${fpBot.y} ${fpLeft.x},${fpLeft.y}`}
          fill="#4f7a3d"
          stroke="#2a3a20"
        />
        <line x1={fpTop.x} y1={fpTop.y} x2={fpBot.x} y2={fpBot.y} stroke="#7a6a52" strokeWidth={2} />
        <ellipse cx={cx - 12} cy={cy - 12} rx={8} ry={10} fill="#3a5530" stroke="#1a2a14" />
        <ellipse cx={cx - 9} cy={cy - 16} rx={6} ry={7} fill="#5b7a45" />
        <ellipse cx={cx + 10} cy={cy - 8} rx={6} ry={8} fill="#3a5530" stroke="#1a2a14" />
        <ellipse cx={cx + 12} cy={cy - 11} rx={4} ry={5} fill="#5b7a45" />
        <rect x={cx - 4} y={cy - 30} width={8} height={26} fill="#7a6a52" stroke="#3a2f24" />
        <polygon points={`${cx - 6},${cy - 30} ${cx},${cy - 38} ${cx + 6},${cy - 30}`} fill="#b9722a" stroke="#3a2f24" />
        <rect x={cx - 2} y={cy - 24} width={4} height={6} fill="#1c1925" />
        <rect x={cx - 1} y={cy - 36} width={2} height={4} fill="#ffc26b" />
        {(hovered || selected) && (
          <polygon
            points={`${fpTop.x},${fpTop.y} ${fpRight.x},${fpRight.y} ${fpBot.x},${fpBot.y} ${fpLeft.x},${fpLeft.y}`}
            fill="none"
            stroke={selected ? '#ffc26b' : '#f0a347'}
            strokeWidth={2}
            strokeDasharray={selected ? '0' : '3 2'}
          />
        )}
      </g>
    );
  }

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

  const doorCx = (fpRight.x + fpBot.x) / 2;
  const doorCy = (fpRight.y + fpBot.y) / 2;

  return (
    <g
      style={{ cursor: 'pointer' }}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onPointerEnter={() => onHover?.(true)}
      onPointerLeave={() => onHover?.(false)}
    >
      {heat && heat.alpha > 0 && (
        <polygon
          points={`${fpTop.x},${fpTop.y} ${fpRight.x},${fpRight.y} ${fpBot.x},${fpBot.y} ${fpLeft.x},${fpLeft.y}`}
          fill={heat.color}
          opacity={heat.alpha}
        />
      )}
      <polygon
        points={`${fpTop.x},${fpTop.y} ${fpRight.x},${fpRight.y} ${fpBot.x},${fpBot.y} ${fpLeft.x},${fpLeft.y}`}
        fill="#2a2230"
        stroke="#0b0a10"
        strokeWidth={1}
      />

      {(b.kind === 'town_hall' || b.kind === 'court' || b.kind === 'bank' || b.kind === 'temple') && (
        <polygon
          points={`${fpTop.x},${fpTop.y - 3} ${fpRight.x},${fpRight.y - 3} ${fpBot.x},${fpBot.y - 3} ${fpLeft.x},${fpLeft.y - 3}`}
          fill={shade(wallColor, 0.1)}
          stroke="#0b0a10"
          strokeWidth={0.5}
        />
      )}

      <polygon points={leftWall} fill={shade(wallColor, -0.28)} stroke="#0b0a10" strokeWidth={1} />
      <polygon points={rightWall} fill={wallColor} stroke="#0b0a10" strokeWidth={1} />

      {renderRoof(b.kind, top, roofColor)}

      <Windows top={top} fpRight={fpRight} fpBot={fpBot} elev={elev} lit={!!lit} wallColor={wallColor} kind={b.kind} />

      <DoorAndSign kind={b.kind} doorCx={doorCx} doorCy={doorCy} wallColor={wallColor} accent={palette.accent} sign={v.sign} />

      {b.kind === 'town_hall' && (
        <>
          <ellipse cx={(top.top.x + top.bot.x) / 2} cy={(top.top.y + top.bot.y) / 2 - 14} rx={12} ry={7} fill={palette.accent} stroke="#0b0a10" />
          <rect x={(top.top.x + top.bot.x) / 2 - 1} y={(top.top.y + top.bot.y) / 2 - 26} width={2} height={12} fill="#ffc26b" />
          <circle cx={(top.top.x + top.bot.x) / 2} cy={(top.top.y + top.bot.y) / 2 - 27} r={2} fill="#ffc26b" />
        </>
      )}
      {b.kind === 'temple' && (
        <>
          <rect x={(top.top.x + top.bot.x) / 2 - 2} y={(top.top.y + top.bot.y) / 2 - 28} width={4} height={16} fill={shade(palette.roof, -0.2)} stroke="#0b0a10" />
          <polygon
            points={`${(top.top.x + top.bot.x) / 2 - 4},${(top.top.y + top.bot.y) / 2 - 28} ${(top.top.x + top.bot.x) / 2},${(top.top.y + top.bot.y) / 2 - 38} ${(top.top.x + top.bot.x) / 2 + 4},${(top.top.y + top.bot.y) / 2 - 28}`}
            fill={palette.accent}
            stroke="#0b0a10"
          />
        </>
      )}
      {b.kind === 'jail' &&
        [0.2, 0.4, 0.6, 0.8].map((f, i) => {
          const wx = fpRight.x + (fpBot.x - fpRight.x) * f;
          const wy = fpRight.y + (fpBot.y - fpRight.y) * f;
          return <line key={i} x1={wx} y1={wy - elev + 6} x2={wx} y2={wy - 4} stroke="#0b0a10" strokeWidth={1} />;
        })}
      {b.kind === 'bank' &&
        [0.25, 0.5, 0.75].map((f, i) => {
          const wx = fpRight.x + (fpBot.x - fpRight.x) * f;
          const wy = fpRight.y + (fpBot.y - fpRight.y) * f;
          return (
            <rect
              key={i}
              x={wx - 1}
              y={wy - elev + 4}
              width={2}
              height={elev - 8}
              fill={shade(wallColor, 0.2)}
              stroke="#0b0a10"
              strokeWidth={0.3}
            />
          );
        })}
      {b.kind === 'court' && (
        <polygon
          points={`${top.left.x + 6},${top.left.y} ${(top.left.x + top.right.x) / 2},${(top.left.y + top.right.y) / 2 - 16} ${top.right.x - 6},${top.right.y}`}
          fill={shade(roofColor, 0.15)}
          stroke="#0b0a10"
        />
      )}
      {b.kind === 'factory' && (
        <>
          <rect x={top.left.x + 8} y={top.left.y - 32} width={6} height={32} fill={shade(wallColor, -0.4)} stroke="#0b0a10" />
          <rect x={top.left.x + 7} y={top.left.y - 36} width={8} height={4} fill={palette.accent} stroke="#0b0a10" />
        </>
      )}
      {b.kind === 'power_plant' && (
        <>
          <rect x={top.right.x - 14} y={top.right.y - 38} width={7} height={38} fill={shade(wallColor, -0.4)} stroke="#0b0a10" />
          <ellipse cx={top.right.x - 10.5} cy={top.right.y - 40} rx={5} ry={2} fill={shade(wallColor, -0.4)} stroke="#0b0a10" />
          <circle cx={top.right.x - 10.5} cy={top.right.y - 40} r={2} fill="#4ec5b8" className="pulse" />
        </>
      )}
      {b.kind === 'water_works' && (
        <>
          <ellipse cx={(top.top.x + top.bot.x) / 2 - 6} cy={(top.top.y + top.bot.y) / 2 - 10} rx={8} ry={5} fill={shade(wallColor, 0.1)} stroke="#0b0a10" />
          <rect x={(top.top.x + top.bot.x) / 2 - 14} y={(top.top.y + top.bot.y) / 2 - 10} width={16} height={10} fill={shade(wallColor, -0.1)} stroke="#0b0a10" />
          <ellipse cx={(top.top.x + top.bot.x) / 2 - 6} cy={(top.top.y + top.bot.y) / 2} rx={8} ry={5} fill={shade(wallColor, -0.2)} stroke="#0b0a10" />
        </>
      )}
      {(b.kind === 'office' || b.kind === 'apartment') && (
        <polyline
          points={`${top.left.x},${top.left.y - 3} ${top.right.x},${top.right.y - 3} ${top.bot.x},${top.bot.y - 3}`}
          fill="none"
          stroke="#0b0a10"
          strokeWidth={0.5}
        />
      )}

      {(hovered || selected) && (
        <polygon
          points={`${fpTop.x},${fpTop.y} ${fpRight.x},${fpRight.y} ${fpBot.x},${fpBot.y} ${fpLeft.x},${fpLeft.y}`}
          fill="none"
          stroke={selected ? '#ffc26b' : '#f0a347'}
          strokeWidth={2}
          strokeDasharray={selected ? '0' : '3 2'}
        />
      )}

      <polygon
        pointerEvents="all"
        points={`${fpTop.x},${fpTop.y - elev - 8} ${fpRight.x},${fpRight.y - elev - 8} ${fpRight.x},${fpRight.y} ${fpBot.x},${fpBot.y} ${fpLeft.x},${fpLeft.y} ${fpLeft.x},${fpLeft.y - elev - 8}`}
        fill="transparent"
      />
    </g>
  );
}

function renderRoof(kind: string, top: RoofGeom, color: string) {
  const flat = [
    `${top.top.x},${top.top.y}`,
    `${top.right.x},${top.right.y}`,
    `${top.bot.x},${top.bot.y}`,
    `${top.left.x},${top.left.y}`,
  ].join(' ');

  if (kind === 'house' || kind === 'house_big' || kind === 'cafe' || kind === 'farm' || kind === 'bar' || kind === 'shop') {
    const peak = { x: (top.top.x + top.bot.x) / 2, y: (top.top.y + top.bot.y) / 2 - 10 };
    return (
      <>
        <polygon points={`${top.left.x},${top.left.y} ${peak.x},${peak.y} ${top.bot.x},${top.bot.y}`} fill={shade(color, -0.15)} stroke="#0b0a10" strokeWidth={1} />
        <polygon points={`${top.top.x},${top.top.y} ${peak.x},${peak.y} ${top.right.x},${top.right.y}`} fill={color} stroke="#0b0a10" strokeWidth={1} />
        <polygon points={`${top.right.x},${top.right.y} ${peak.x},${peak.y} ${top.bot.x},${top.bot.y}`} fill={shade(color, 0.05)} stroke="#0b0a10" strokeWidth={1} />
        <line x1={top.top.x} y1={top.top.y} x2={peak.x} y2={peak.y} stroke={shade(color, 0.3)} strokeWidth={0.5} />
      </>
    );
  }

  if (kind === 'factory') {
    return (
      <>
        <polygon points={flat} fill={color} stroke="#0b0a10" strokeWidth={1} />
        {[0.18, 0.5, 0.82].map((f, i) => {
          const ax = top.left.x + (top.right.x - top.left.x) * f;
          const ay = top.left.y + (top.right.y - top.left.y) * f;
          const bx = top.left.x + (top.right.x - top.left.x) * (f + 0.08);
          const by = top.left.y + (top.right.y - top.left.y) * (f + 0.08);
          return (
            <polygon
              key={i}
              points={`${ax},${ay} ${bx},${by - 6} ${bx + 2},${by}`}
              fill={shade(color, -0.25)}
              stroke="#0b0a10"
              strokeWidth={0.4}
            />
          );
        })}
      </>
    );
  }

  return (
    <>
      <polygon points={flat} fill={color} stroke="#0b0a10" strokeWidth={1} />
      <line x1={top.left.x} y1={top.left.y} x2={top.right.x} y2={top.right.y} stroke={shade(color, 0.25)} strokeWidth={1} />
    </>
  );
}

function Windows({
  fpRight,
  fpBot,
  elev,
  lit,
  wallColor,
  kind,
}: {
  top: RoofGeom;
  fpRight: { x: number; y: number };
  fpBot: { x: number; y: number };
  elev: number;
  lit: boolean;
  wallColor: string;
  kind: string;
}) {
  const wallVec = { x: fpBot.x - fpRight.x, y: fpBot.y - fpRight.y };
  const wallLen = Math.hypot(wallVec.x, wallVec.y);

  let rows: number;
  let cols: number;
  let pattern: 'grid' | 'wide' | 'tall';
  if (kind === 'office' || kind === 'apartment') {
    rows = Math.max(2, Math.floor(elev / 14));
    cols = Math.max(2, Math.floor(wallLen / 18));
    pattern = 'grid';
  } else if (kind === 'factory' || kind === 'water_works' || kind === 'power_plant') {
    rows = 1;
    cols = Math.max(2, Math.floor(wallLen / 16));
    pattern = 'wide';
  } else if (kind === 'temple' || kind === 'court' || kind === 'town_hall' || kind === 'bank') {
    rows = Math.max(1, Math.floor(elev / 22));
    cols = Math.max(1, Math.floor(wallLen / 24));
    pattern = 'tall';
  } else {
    rows = Math.max(1, Math.floor(elev / 18));
    cols = Math.max(1, Math.floor(wallLen / 20));
    pattern = 'grid';
  }

  const litFill = '#ffd58a';
  const darkFill = shade(wallColor, -0.55);
  const out: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const fx = (c + 1) / (cols + 1);
      const fy = (r + 0.5) / rows;
      const wx = fpRight.x + wallVec.x * fx;
      const wy = fpRight.y + wallVec.y * fx;
      const py = wy - (1 - fy) * elev - 4;
      const litThis = lit && (r * 7 + c * 13) % 5 !== 0;
      const fill = litThis ? litFill : darkFill;
      const w = pattern === 'wide' ? 8 : pattern === 'tall' ? 4 : 5;
      const h = pattern === 'tall' ? 9 : pattern === 'wide' ? 5 : 5;
      out.push(
        <rect
          key={`w-${r}-${c}`}
          x={wx - w / 2}
          y={py - h / 2}
          width={w}
          height={h}
          fill={fill}
          stroke="#0b0a10"
          strokeWidth={0.5}
        />,
      );
    }
  }
  return <>{out}</>;
}

function DoorAndSign({
  kind,
  doorCx,
  doorCy,
  wallColor,
  accent,
  sign,
}: {
  kind: string;
  doorCx: number;
  doorCy: number;
  wallColor: string;
  accent: string;
  sign: number;
}) {
  const doorW = 9;
  const doorH = 16;
  return (
    <g>
      <rect x={doorCx - doorW / 2} y={doorCy - doorH} width={doorW} height={doorH} fill={shade(wallColor, -0.5)} stroke="#0b0a10" />
      <rect x={doorCx - 1} y={doorCy - doorH / 2 - 1} width={1.5} height={1.5} fill={accent} />
      {(kind === 'shop' || kind === 'bar' || kind === 'cafe') && (
        <>
          <polygon
            points={`${doorCx - doorW / 2 - 4},${doorCy - doorH - 2} ${doorCx + doorW / 2 + 4},${doorCy - doorH - 2} ${doorCx + doorW / 2 + 6},${doorCy - doorH + 4} ${doorCx - doorW / 2 - 6},${doorCy - doorH + 4}`}
            fill={accent}
            stroke="#0b0a10"
            strokeWidth={0.5}
          />
          {[0, 0.33, 0.66, 1].map((f, i) => (
            <line
              key={i}
              x1={doorCx - doorW / 2 - 4 + (doorW + 8) * f}
              y1={doorCy - doorH - 2}
              x2={doorCx - doorW / 2 - 6 + (doorW + 12) * f}
              y2={doorCy - doorH + 4}
              stroke={shade(accent, -0.3)}
              strokeWidth={0.4}
            />
          ))}
        </>
      )}
      {kind === 'bar' && (
        <>
          <line x1={doorCx} y1={doorCy - doorH + 4} x2={doorCx} y2={doorCy - doorH + 9} stroke="#0b0a10" strokeWidth={0.5} />
          <rect x={doorCx - 2} y={doorCy - doorH + 9} width={4} height={4} fill="#ffd58a" stroke="#0b0a10" strokeWidth={0.5} />
        </>
      )}
      {(kind === 'shop' || kind === 'office' || kind === 'bank' || kind === 'bar') && (
        <rect
          x={doorCx + doorW / 2 + 1}
          y={doorCy - doorH + 2}
          width={5}
          height={4}
          fill={sign > 0.5 ? '#cdb98a' : accent}
          stroke="#0b0a10"
          strokeWidth={0.3}
        />
      )}
    </g>
  );
}
