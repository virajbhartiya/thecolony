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

export default function BuildingSprite({ b, hovered, selected, lit, heat, onClick, onHover }: Props) {
  const palette = buildingPalette(b.kind);
  const w = b.tile_w;
  const h = b.tile_h;
  const elev = palette.elev;

  // footprint corners in iso world space
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

  const top = {
    top: { x: fpTop.x, y: fpTop.y - elev },
    right: { x: fpRight.x, y: fpRight.y - elev },
    bot: { x: fpBot.x, y: fpBot.y - elev },
    left: { x: fpLeft.x, y: fpLeft.y - elev },
  };

  // park = green diamond + tree + bell
  if (b.kind === 'park') {
    return (
      <g
        style={{ cursor: 'pointer' }}
        onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        onMouseEnter={() => onHover?.(true)}
        onMouseLeave={() => onHover?.(false)}
      >
        <polygon
          points={`${fpTop.x},${fpTop.y} ${fpRight.x},${fpRight.y} ${fpBot.x},${fpBot.y} ${fpLeft.x},${fpLeft.y}`}
          fill="#4f7a3d"
          stroke="#2a3a20"
        />
        <ellipse cx={cx} cy={cy - 18} rx={14} ry={16} fill="#3a5530" stroke="#1a2a14" />
        <ellipse cx={cx + 4} cy={cy - 22} rx={10} ry={12} fill="#5b7a45" />
        <rect x={cx - 2} y={cy - 6} width={4} height={8} fill="#4a3320" />
        <rect x={cx - 18} y={cy - 36} width={8} height={28} fill="#7a6a52" stroke="#3a2f24" />
        <polygon
          points={`${cx - 22},${cy - 36} ${cx - 14},${cy - 44} ${cx - 6},${cy - 36}`}
          fill="#b9722a"
          stroke="#3a2f24"
        />
        <rect x={cx - 17} y={cy - 28} width={6} height={6} fill="#1c1925" />
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
  const roof = [
    `${top.top.x},${top.top.y}`,
    `${top.right.x},${top.right.y}`,
    `${top.bot.x},${top.bot.y}`,
    `${top.left.x},${top.left.y}`,
  ].join(' ');

  const doorCx = (fpRight.x + fpBot.x) / 2;
  const doorCy = (fpRight.y + fpBot.y) / 2;
  const doorW = 9;
  const doorH = 16;

  const windows: Array<{ x: number; y: number; w: number; h: number }> = [];
  const wRowCount = Math.max(1, Math.floor(elev / 18));
  const wColCount = Math.max(1, Math.min(b.tile_w + b.tile_h, 4));
  for (let r = 0; r < wRowCount; r++) {
    for (let c = 0; c < wColCount; c++) {
      const fx = (c + 1) / (wColCount + 1);
      const fy = (r + 0.5) / wRowCount;
      const wx = fpRight.x + (fpBot.x - fpRight.x) * fx;
      const wy = fpRight.y + (fpBot.y - fpRight.y) * fx;
      const py = wy - (1 - fy) * elev - 4;
      windows.push({ x: wx - 3, y: py - 4, w: 6, h: 6 });
    }
  }

  return (
    <g
      style={{ cursor: 'pointer' }}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
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
      <polygon points={leftWall} fill={shade(palette.wall, -0.28)} stroke="#0b0a10" strokeWidth={1} />
      <polygon points={rightWall} fill={palette.wall} stroke="#0b0a10" strokeWidth={1} />
      <polygon points={roof} fill={palette.roof} stroke="#0b0a10" strokeWidth={1} />
      <line
        x1={top.left.x}
        y1={top.left.y}
        x2={top.right.x}
        y2={top.right.y}
        stroke={shade(palette.roof, 0.25)}
        strokeWidth={1}
      />
      <rect
        x={doorCx - doorW / 2}
        y={doorCy - doorH}
        width={doorW}
        height={doorH}
        fill={shade(palette.wall, -0.5)}
        stroke="#0b0a10"
      />
      <rect x={doorCx - 1} y={doorCy - doorH / 2 - 1} width={1.5} height={1.5} fill={palette.accent} />
      {windows.map((win, i) => (
        <rect
          key={i}
          x={win.x}
          y={win.y}
          width={win.w}
          height={win.h}
          fill={lit ? '#ffd58a' : shade(palette.wall, -0.55)}
          stroke="#0b0a10"
        />
      ))}
      {b.kind === 'town_hall' && (
        <>
          <ellipse
            cx={(top.top.x + top.bot.x) / 2}
            cy={(top.top.y + top.bot.y) / 2 - 14}
            rx={10}
            ry={6}
            fill="#b9722a"
            stroke="#0b0a10"
          />
          <rect
            x={(top.top.x + top.bot.x) / 2 - 1}
            y={(top.top.y + top.bot.y) / 2 - 24}
            width={2}
            height={10}
            fill="#ffc26b"
          />
        </>
      )}
      {b.kind === 'bank' && (
        <rect
          x={(top.top.x + top.bot.x) / 2 - 12}
          y={(top.top.y + top.bot.y) / 2 - 6}
          width={24}
          height={4}
          fill="#cdb98a"
          stroke="#0b0a10"
        />
      )}
      {b.kind === 'factory' && (
        <>
          <rect
            x={top.left.x + 8}
            y={top.left.y - 30}
            width={6}
            height={30}
            fill={shade(palette.wall, -0.4)}
            stroke="#0b0a10"
          />
          <rect
            x={top.left.x + 7}
            y={top.left.y - 34}
            width={8}
            height={4}
            fill={palette.accent}
            stroke="#0b0a10"
          />
        </>
      )}
      {b.kind === 'power_plant' && (
        <>
          <rect
            x={top.right.x - 14}
            y={top.right.y - 36}
            width={6}
            height={36}
            fill={shade(palette.wall, -0.4)}
            stroke="#0b0a10"
          />
          <circle cx={top.right.x - 11} cy={top.right.y - 38} r={3} fill="#4ec5b8" className="pulse" />
        </>
      )}
      {b.kind === 'court' && (
        <polygon
          points={`${top.left.x + 6},${top.left.y} ${(top.left.x + top.right.x) / 2},${
            (top.left.y + top.right.y) / 2 - 14
          } ${top.right.x - 6},${top.right.y}`}
          fill={shade(palette.roof, 0.15)}
          stroke="#0b0a10"
        />
      )}
      {b.kind === 'jail' &&
        [0.2, 0.4, 0.6, 0.8].map((f, i) => {
          const wx = fpRight.x + (fpBot.x - fpRight.x) * f;
          const wy = fpRight.y + (fpBot.y - fpRight.y) * f;
          return <line key={i} x1={wx} y1={wy - elev + 6} x2={wx} y2={wy - 4} stroke="#0b0a10" />;
        })}
      {b.kind === 'temple' && (
        <polygon
          points={`${top.left.x + 4},${top.left.y - 2} ${(top.left.x + top.right.x) / 2},${
            (top.left.y + top.right.y) / 2 - 22
          } ${top.right.x - 4},${top.right.y - 2}`}
          fill={shade(palette.roof, 0.2)}
          stroke="#0b0a10"
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
        points={`${fpTop.x},${fpTop.y - elev} ${fpRight.x},${fpRight.y - elev} ${fpRight.x},${fpRight.y} ${fpBot.x},${fpBot.y} ${fpLeft.x},${fpLeft.y} ${fpLeft.x},${fpLeft.y - elev}`}
        fill="transparent"
      />
    </g>
  );
}
