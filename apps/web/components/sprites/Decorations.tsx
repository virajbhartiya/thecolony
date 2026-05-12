'use client';
import { useMemo } from 'react';
import { tileToWorld } from '../../lib/iso';
import { generateTerrain } from '../../lib/terrain';

interface Props {
  width: number;
  height: number;
  buildings: Array<{ tile_x: number; tile_y: number; tile_w: number; tile_h: number; kind: string }>;
  lit: boolean;
  nowMs: number;
}

interface Decoration {
  kind: 'tree' | 'lamp' | 'cart' | 'bench' | 'boat' | 'crate';
  tx: number;
  ty: number;
  seed: number;
}

function hash(x: number, y: number, salt = 0): number {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + salt * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}

export default function Decorations({ width, height, buildings, lit, nowMs }: Props) {
  const decorations = useMemo<Decoration[]>(() => {
    const terrain = generateTerrain(width, height, 42);
    const occupied = new Set<string>();
    for (const b of buildings) {
      for (let dy = -1; dy <= b.tile_h; dy++) {
        for (let dx = -1; dx <= b.tile_w; dx++) {
          occupied.add(`${b.tile_x + dx},${b.tile_y + dy}`);
        }
      }
    }
    let minX = width, minY = height, maxX = 0, maxY = 0;
    if (buildings.length > 0) {
      for (const b of buildings) {
        if (b.tile_x < minX) minX = b.tile_x;
        if (b.tile_y < minY) minY = b.tile_y;
        if (b.tile_x + b.tile_w > maxX) maxX = b.tile_x + b.tile_w;
        if (b.tile_y + b.tile_h > maxY) maxY = b.tile_y + b.tile_h;
      }
    }
    const PAD = 6;
    const x0 = Math.max(0, Math.floor(minX) - PAD);
    const y0 = Math.max(0, Math.floor(minY) - PAD);
    const x1 = Math.min(width - 1, Math.ceil(maxX) + PAD);
    const y1 = Math.min(height - 1, Math.ceil(maxY) + PAD);

    const out: Decoration[] = [];
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (occupied.has(`${tx},${ty}`)) continue;
        const t = terrain[ty]![tx]!;
        const h = hash(tx, ty, 1);
        // trees scattered on grass (denser now)
        if (t === 'grass' && h % 100 < 14) out.push({ kind: 'tree', tx, ty, seed: h });
        // street lamps every few tiles along roads
        else if (t === 'road' && h % 100 < 14 && (tx + ty) % 3 === 0)
          out.push({ kind: 'lamp', tx, ty, seed: h });
        // boats on water
        else if (t === 'water' && h % 100 < 7) out.push({ kind: 'boat', tx, ty, seed: h });
      }
    }
    // benches near parks/temples, carts near shops
    for (const b of buildings) {
      if (b.kind === 'park') {
        out.push({ kind: 'bench', tx: b.tile_x + b.tile_w + 1, ty: b.tile_y, seed: hash(b.tile_x, b.tile_y, 9) });
      }
      if (b.kind === 'shop' || b.kind === 'bar') {
        const tx = b.tile_x + b.tile_w;
        const ty = b.tile_y + Math.floor(b.tile_h / 2);
        if (!occupied.has(`${tx},${ty}`)) {
          out.push({ kind: 'cart', tx, ty, seed: hash(b.tile_x, b.tile_y, 11) });
        }
      }
      if (b.kind === 'factory') {
        const tx = b.tile_x - 1;
        const ty = b.tile_y + b.tile_h;
        if (!occupied.has(`${tx},${ty}`)) {
          out.push({ kind: 'crate', tx, ty, seed: hash(b.tile_x, b.tile_y, 12) });
        }
      }
    }
    return out;
  }, [width, height, buildings]);

  // Sort by world y for proper isometric depth
  const sorted = useMemo(
    () =>
      [...decorations].sort((a, b) => a.tx + a.ty - (b.tx + b.ty)),
    [decorations],
  );

  return (
    <>
      {sorted.map((d) => {
        const p = tileToWorld(d.tx, d.ty);
        switch (d.kind) {
          case 'tree':
            return <Tree key={`tr-${d.tx}-${d.ty}`} x={p.x} y={p.y} variant={d.seed % 3} />;
          case 'lamp':
            return <Lamp key={`lp-${d.tx}-${d.ty}`} x={p.x} y={p.y} lit={lit} />;
          case 'cart':
            return <Cart key={`ct-${d.tx}-${d.ty}`} x={p.x} y={p.y} variant={d.seed % 3} />;
          case 'bench':
            return <Bench key={`bn-${d.tx}-${d.ty}`} x={p.x} y={p.y} />;
          case 'crate':
            return <Crates key={`cr-${d.tx}-${d.ty}`} x={p.x} y={p.y} />;
          case 'boat':
            return <Boat key={`bt-${d.tx}-${d.ty}`} x={p.x} y={p.y} variant={d.seed % 2} nowMs={nowMs} />;
        }
      })}
      {/* smoke plumes rising from factory / power plant chimneys */}
      {buildings
        .filter((b) => b.kind === 'factory' || b.kind === 'power_plant')
        .map((b) => {
          const cx = (b.tile_x - b.tile_y) * 28;
          const cy = (b.tile_x + b.tile_y) * 14;
          const back = tileToWorld(b.tile_x + b.tile_w - 1, b.tile_y + b.tile_h - 1);
          const fpW = (b.tile_w + b.tile_h) * 28;
          const fpH = (b.tile_w + b.tile_h) * 14;
          const ax = (cx + back.x) / 2;
          const ay = (cx + back.y) / 2;
          void fpW;
          void fpH;
          // chimney positions roughly the same as in BuildingSprite
          const x = b.kind === 'factory' ? ax - fpW / 2 + 12 : ax + fpW / 2 - 12;
          const y = b.kind === 'factory' ? ay - fpH / 2 - 30 : ay - fpH / 2 - 36;
          return (
            <Smoke key={`sm-${b.tile_x}-${b.tile_y}`} x={x} y={y} nowMs={nowMs} />
          );
        })}
    </>
  );
}

function Tree({ x, y, variant }: { x: number; y: number; variant: number }) {
  const foliage = variant === 0 ? '#3a5530' : variant === 1 ? '#4f7a3d' : '#5b7a45';
  const highlight = variant === 0 ? '#5b7a45' : variant === 1 ? '#6f9555' : '#7faa66';
  return (
    <g>
      <ellipse cx={x} cy={y + 2} rx={6} ry={2} fill="#000" opacity={0.4} />
      <rect x={x - 1.5} y={y - 6} width={3} height={6} fill="#4a3320" />
      <ellipse cx={x} cy={y - 12} rx={7} ry={9} fill={foliage} stroke="#1a2014" strokeWidth={0.5} />
      <ellipse cx={x + 2} cy={y - 15} rx={5} ry={6} fill={highlight} />
    </g>
  );
}

function Lamp({ x, y, lit }: { x: number; y: number; lit: boolean }) {
  return (
    <g>
      <ellipse cx={x} cy={y + 1} rx={3} ry={1} fill="#000" opacity={0.4} />
      <rect x={x - 0.6} y={y - 16} width={1.2} height={16} fill="#3a304a" />
      <rect x={x - 3} y={y - 22} width={6} height={6} fill={lit ? '#ffd58a' : '#332a3f'} stroke="#0b0a10" strokeWidth={0.5} />
      {lit && (
        <circle cx={x} cy={y - 19} r={10} fill="#ffd58a" opacity={0.12} />
      )}
    </g>
  );
}

function Cart({ x, y, variant }: { x: number; y: number; variant: number }) {
  const color = variant === 0 ? '#b9722a' : variant === 1 ? '#7a4a25' : '#5a3c66';
  return (
    <g>
      <ellipse cx={x} cy={y + 1} rx={8} ry={2} fill="#000" opacity={0.4} />
      <rect x={x - 6} y={y - 8} width={12} height={6} fill={color} stroke="#0b0a10" />
      <rect x={x - 5} y={y - 11} width={10} height={3} fill="#cdb98a" stroke="#0b0a10" />
      <circle cx={x - 4} cy={y - 1} r={2} fill="#2a2236" stroke="#0b0a10" />
      <circle cx={x + 4} cy={y - 1} r={2} fill="#2a2236" stroke="#0b0a10" />
    </g>
  );
}

function Bench({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x - 5} y={y - 4} width={10} height={2} fill="#4a3320" stroke="#0b0a10" strokeWidth={0.5} />
      <rect x={x - 5} y={y - 2} width={1} height={3} fill="#4a3320" />
      <rect x={x + 4} y={y - 2} width={1} height={3} fill="#4a3320" />
    </g>
  );
}

function Crates({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x - 5} y={y - 6} width={5} height={5} fill="#8a6a4a" stroke="#0b0a10" strokeWidth={0.5} />
      <rect x={x + 1} y={y - 5} width={5} height={4} fill="#7a5a3e" stroke="#0b0a10" strokeWidth={0.5} />
      <rect x={x - 2} y={y - 10} width={5} height={4} fill="#9a7a5a" stroke="#0b0a10" strokeWidth={0.5} />
    </g>
  );
}

function Boat({ x, y, variant, nowMs }: { x: number; y: number; variant: number; nowMs: number }) {
  const bob = Math.sin(nowMs / 600 + x * 0.1) * 1;
  const color = variant === 0 ? '#5a3c66' : '#7a4a25';
  return (
    <g transform={`translate(0, ${bob})`}>
      <ellipse cx={x} cy={y + 1} rx={10} ry={2} fill="#000" opacity={0.3} />
      <path
        d={`M ${x - 9},${y - 1} Q ${x},${y + 2} ${x + 9},${y - 1} L ${x + 7},${y - 4} L ${x - 7},${y - 4} Z`}
        fill={color}
        stroke="#0b0a10"
        strokeWidth={0.5}
      />
      <rect x={x - 0.5} y={y - 12} width={1} height={8} fill="#cdb98a" />
      <polygon points={`${x + 0.5},${y - 12} ${x + 5},${y - 9} ${x + 0.5},${y - 6}`} fill="#ece6d3" stroke="#0b0a10" strokeWidth={0.5} />
    </g>
  );
}

function Smoke({ x, y, nowMs }: { x: number; y: number; nowMs: number }) {
  const t = nowMs / 800;
  return (
    <g>
      {[0, 1, 2].map((i) => {
        const phase = (t + i * 0.33) % 1;
        const rise = phase * 26;
        const r = 3 + phase * 5;
        const opacity = (1 - phase) * 0.55;
        return (
          <circle
            key={i}
            cx={x + Math.sin((t + i) * 1.3) * 2}
            cy={y - rise}
            r={r}
            fill="#8a8478"
            opacity={opacity}
          />
        );
      })}
    </g>
  );
}
