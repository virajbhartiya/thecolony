'use client';
import { useEffect, useRef, useState } from 'react';
import { useWorld } from '../lib/store';
import { tileToWorld, TILE_W, TILE_H } from '../lib/iso';
import { generateTerrain } from '../lib/terrain';

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2.5;

const TERRAIN_COLORS: Record<string, string> = {
  grass: '#4d7a3a',
  road: '#3a3a44',
  water: '#2a55a8',
  sand: '#cdb87a',
  plaza: '#7a7363',
  sidewalk: '#6c6c7a',
};

const BUILDING_PALETTE: Record<string, { roof: string; wall: string; height: number }> = {
  house: { roof: '#b6614a', wall: '#cfb18a', height: 26 },
  apartment: { roof: '#9a5a76', wall: '#d9c2a3', height: 56 },
  shop: { roof: '#dba14a', wall: '#e6d9b6', height: 30 },
  factory: { roof: '#4a4f5a', wall: '#8d8d97', height: 46 },
  farm: { roof: '#6e4a2a', wall: '#c6a36c', height: 20 },
  bar: { roof: '#5a3c66', wall: '#b88fb1', height: 28 },
  restaurant: { roof: '#9f3d2f', wall: '#e3c391', height: 32 },
  office: { roof: '#3a3f5a', wall: '#b8c1e0', height: 64 },
  clinic: { roof: '#2f6f73', wall: '#d6ece8', height: 42 },
  school: { roof: '#7b5a2f', wall: '#d8bf8a', height: 38 },
  newsroom: { roof: '#4d4f59', wall: '#c4c7d1', height: 36 },
  construction_yard: { roof: '#6b542d', wall: '#a99672', height: 24 },
  bank: { roof: '#222a44', wall: '#d4c8a4', height: 52 },
  court: { roof: '#5c5247', wall: '#eae2cf', height: 48 },
  jail: { roof: '#2a2a2a', wall: '#7a7670', height: 34 },
  temple: { roof: '#e0c266', wall: '#eae0bd', height: 62 },
  town_hall: { roof: '#cab36a', wall: '#eadcb0', height: 58 },
  water_works: { roof: '#355a7a', wall: '#a0b8c8', height: 34 },
  power_plant: { roof: '#4a3a2a', wall: '#988877', height: 42 },
};

const AGENT_STATE_COLOR: Record<string, string> = {
  idle: '#a3e0b6',
  walking: '#7ee787',
  working: '#f5d265',
  sleeping: '#7ea3e0',
  eating: '#e07e9c',
  speaking: '#e0c87e',
  jailed: '#f85149',
  dead: '#555555',
};

interface Camera {
  x: number;
  y: number;
  scale: number;
}

export default function CityCanvas({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  // Local positions cached for smooth interpolation — keyed by agent id.
  const localPos = useRef<Map<string, { x: number; y: number }>>(new Map());
  // Bumps a render so screen stays painted even when nothing moves.
  const [, setTick] = useState(0);
  void setTick;

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('2D context unavailable');
      return;
    }

    let cancelled = false;
    let rafId = 0;

    // ---------- terrain cache ----------
    const W = useWorld.getState().width || 96;
    const H = useWorld.getState().height || 96;
    const terrain = generateTerrain(W, H, 42);

    // ---------- camera ----------
    const cam: Camera = { x: 0, y: 0, scale: 0.85 };
    const recenter = () => {
      const c = tileToWorld(48, 48);
      cam.x = canvas.width / (window.devicePixelRatio || 1) / 2 - c.x * cam.scale;
      cam.y = canvas.height / (window.devicePixelRatio || 1) / 2 - c.y * cam.scale;
    };

    const fitCanvas = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cssW = container.clientWidth;
      const cssH = container.clientHeight;
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    fitCanvas();
    recenter();

    // ---------- input ----------
    const keys = new Set<string>();
    const onKeyDown = (ev: KeyboardEvent) => keys.add(ev.key.toLowerCase());
    const onKeyUp = (ev: KeyboardEvent) => keys.delete(ev.key.toLowerCase());
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const onPointerDown = (ev: PointerEvent) => {
      dragging = true;
      lastX = ev.clientX;
      lastY = ev.clientY;
      canvas.setPointerCapture(ev.pointerId);
    };
    const onPointerMove = (ev: PointerEvent) => {
      if (!dragging) return;
      cam.x += ev.clientX - lastX;
      cam.y += ev.clientY - lastY;
      lastX = ev.clientX;
      lastY = ev.clientY;
      useWorld.setState({ followAgentId: null });
    };
    const onPointerUp = () => {
      dragging = false;
    };
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const delta = ev.deltaY < 0 ? 1.1 : 0.9;
      const ns = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, cam.scale * delta));
      const rect = canvas.getBoundingClientRect();
      const mx = ev.clientX - rect.left;
      const my = ev.clientY - rect.top;
      const wx = (mx - cam.x) / cam.scale;
      const wy = (my - cam.y) / cam.scale;
      cam.scale = ns;
      cam.x = mx - wx * ns;
      cam.y = my - wy * ns;
    };

    // click → select nearest agent (within tolerance) else nearest building
    const onClick = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = ev.clientX - rect.left;
      const my = ev.clientY - rect.top;
      // world coords
      const wx = (mx - cam.x) / cam.scale;
      const wy = (my - cam.y) / cam.scale;
      // agents
      const agents = useWorld.getState().agents;
      let bestAgent: { id: string; d: number } | null = null;
      for (const [id, a] of agents) {
        const lp = localPos.current.get(id) ?? { x: a.pos_x, y: a.pos_y };
        const p = tileToWorld(lp.x, lp.y);
        const d = Math.hypot(p.x - wx, p.y - wy);
        if (d < 14 && (!bestAgent || d < bestAgent.d)) bestAgent = { id, d };
      }
      if (bestAgent) {
        useWorld.getState().selectAgent(bestAgent.id);
        return;
      }
      // buildings
      const buildings = useWorld.getState().buildings;
      let bestBuilding: { id: string; d: number } | null = null;
      for (const b of buildings) {
        const c = tileToWorld(b.tile_x + b.tile_w / 2, b.tile_y + b.tile_h / 2);
        const r = Math.max(b.tile_w, b.tile_h) * Math.max(TILE_W, TILE_H);
        const d = Math.hypot(c.x - wx, c.y - wy);
        if (d < r && (!bestBuilding || d < bestBuilding.d)) bestBuilding = { id: b.id, d };
      }
      if (bestBuilding) useWorld.getState().selectBuilding(bestBuilding.id);
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('click', onClick);

    const ro = new ResizeObserver(() => fitCanvas());
    ro.observe(container);

    // ---------- main loop ----------
    const SPEED = 0.6;
    let prev = performance.now();

    const frame = () => {
      if (cancelled) return;
      const now = performance.now();
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;

      // pan
      const PAN = 700 * dt;
      if (keys.has('w') || keys.has('arrowup')) cam.y += PAN;
      if (keys.has('s') || keys.has('arrowdown')) cam.y -= PAN;
      if (keys.has('a') || keys.has('arrowleft')) cam.x += PAN;
      if (keys.has('d') || keys.has('arrowright')) cam.x -= PAN;

      // sync local positions toward target
      const agents = useWorld.getState().agents;
      const moveDelta = SPEED * dt;
      for (const [id, a] of agents) {
        let lp = localPos.current.get(id);
        if (!lp) {
          lp = { x: a.pos_x, y: a.pos_y };
          localPos.current.set(id, lp);
        }
        const dx = a.target_x - lp.x;
        const dy = a.target_y - lp.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.0001) {
          const step = Math.min(dist, moveDelta);
          lp.x += (dx / dist) * step;
          lp.y += (dy / dist) * step;
        }
      }
      // drop stale
      for (const id of Array.from(localPos.current.keys())) {
        if (!agents.has(id)) localPos.current.delete(id);
      }

      // follow camera
      const followId = useWorld.getState().followAgentId;
      if (followId) {
        const lp = localPos.current.get(followId);
        if (lp) {
          const p = tileToWorld(lp.x, lp.y);
          const dpr = 1; // already accounted for in fitCanvas transform
          cam.x = canvas.clientWidth / (2 * dpr) - p.x * cam.scale;
          cam.y = canvas.clientHeight / (2 * dpr) - p.y * cam.scale;
        }
      }

      // ---------- draw ----------
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      ctx.save();
      ctx.fillStyle = '#0a0d14';
      ctx.fillRect(0, 0, cssW, cssH);

      ctx.translate(cam.x, cam.y);
      ctx.scale(cam.scale, cam.scale);

      // viewport bounds in world coords (cull)
      const vx0 = -cam.x / cam.scale;
      const vy0 = -cam.y / cam.scale;
      const vx1 = vx0 + cssW / cam.scale;
      const vy1 = vy0 + cssH / cam.scale;
      const PAD = 80;

      // terrain
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const p = tileToWorld(x, y);
          if (p.x < vx0 - PAD || p.x > vx1 + PAD || p.y < vy0 - PAD || p.y > vy1 + PAD) continue;
          const kind = terrain[y]?.[x] ?? 'grass';
          drawIsoTile(ctx, p.x, p.y, TERRAIN_COLORS[kind] ?? '#444');
        }
      }

      // buildings + agents — depth-sort together by their anchor y
      const buildings = useWorld.getState().buildings;
      type DrawItem =
        | { kind: 'b'; depth: number; data: (typeof buildings)[number] }
        | { kind: 'a'; depth: number; id: string; lp: { x: number; y: number }; agent: any };
      const items: DrawItem[] = [];
      for (const b of buildings) {
        const c = tileToWorld(b.tile_x + b.tile_w / 2, b.tile_y + b.tile_h / 2);
        if (c.x < vx0 - 200 || c.x > vx1 + 200 || c.y < vy0 - 200 || c.y > vy1 + 200) continue;
        items.push({ kind: 'b', depth: c.y, data: b });
      }
      for (const [id, a] of agents) {
        const lp = localPos.current.get(id);
        if (!lp) continue;
        const p = tileToWorld(lp.x, lp.y);
        if (p.x < vx0 - 80 || p.x > vx1 + 80 || p.y < vy0 - 80 || p.y > vy1 + 80) continue;
        items.push({ kind: 'a', depth: p.y, id, lp, agent: a });
      }
      items.sort((a, b) => a.depth - b.depth);

      for (const it of items) {
        if (it.kind === 'b') drawBuilding(ctx, it.data);
        else drawAgent(ctx, it.lp, it.agent);
      }

      // bubbles / floaters above everything
      const nowMs = Date.now();
      for (const [id, a] of agents) {
        const lp = localPos.current.get(id);
        if (!lp) continue;
        const p = tileToWorld(lp.x, lp.y);
        if (p.x < vx0 - 200 || p.x > vx1 + 200) continue;
        if (a.lastBubble && a.lastBubble.expires > nowMs) {
          drawBubble(ctx, p.x, p.y - 28, a.lastBubble.text);
        }
        if (a.lastFloater && a.lastFloater.expires > nowMs) {
          const rem = (a.lastFloater.expires - nowMs) / 1800;
          drawFloater(
            ctx,
            p.x,
            p.y - 22 - (1 - rem) * 18,
            a.lastFloater.text,
            a.lastFloater.color,
            rem,
          );
        }
      }

      ctx.restore();

      // selected outline overlay (screen space)
      const selBId = useWorld.getState().selectedBuildingId;
      if (selBId) {
        const b = buildings.find((x) => x.id === selBId);
        if (b)
          drawSelectionRing(
            ctx,
            cam,
            tileToWorld(b.tile_x + b.tile_w / 2, b.tile_y + b.tile_h / 2),
          );
      }
      const selAId = useWorld.getState().selectedAgentId;
      if (selAId) {
        const lp = localPos.current.get(selAId);
        if (lp) drawSelectionRing(ctx, cam, tileToWorld(lp.x, lp.y), 18);
      }

      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel as any);
      canvas.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className={className ?? 'absolute inset-0'}>
      <canvas ref={canvasRef} className="absolute inset-0 block" />
      {error && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 glass rounded-lg px-4 py-3 text-xs text-rose-300 max-w-md">
          Renderer error: {error}
        </div>
      )}
    </div>
  );
}

// ---------- drawing helpers ----------

function drawIsoTile(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.beginPath();
  ctx.moveTo(x, y - TILE_H / 2);
  ctx.lineTo(x + TILE_W / 2, y);
  ctx.lineTo(x, y + TILE_H / 2);
  ctx.lineTo(x - TILE_W / 2, y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawBuilding(
  ctx: CanvasRenderingContext2D,
  b: { kind: string; name: string; tile_x: number; tile_y: number; tile_w: number; tile_h: number },
) {
  const palette = BUILDING_PALETTE[b.kind] ?? BUILDING_PALETTE.house!;
  const hp = palette.height;
  const tl = tileToWorld(b.tile_x, b.tile_y);
  const tr = tileToWorld(b.tile_x + b.tile_w, b.tile_y);
  const br = tileToWorld(b.tile_x + b.tile_w, b.tile_y + b.tile_h);
  const bl = tileToWorld(b.tile_x, b.tile_y + b.tile_h);

  // base shadow
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(tr.x, tr.y);
  ctx.lineTo(br.x, br.y);
  ctx.lineTo(bl.x, bl.y);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fill();

  // right wall
  ctx.beginPath();
  ctx.moveTo(tr.x, tr.y);
  ctx.lineTo(tr.x, tr.y - hp);
  ctx.lineTo(br.x, br.y - hp);
  ctx.lineTo(br.x, br.y);
  ctx.closePath();
  ctx.fillStyle = palette.wall;
  ctx.fill();

  // front (left) wall — darker
  ctx.beginPath();
  ctx.moveTo(br.x, br.y);
  ctx.lineTo(br.x, br.y - hp);
  ctx.lineTo(bl.x, bl.y - hp);
  ctx.lineTo(bl.x, bl.y);
  ctx.closePath();
  ctx.fillStyle = darken(palette.wall, 0.78);
  ctx.fill();

  // roof
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y - hp);
  ctx.lineTo(tr.x, tr.y - hp);
  ctx.lineTo(br.x, br.y - hp);
  ctx.lineTo(bl.x, bl.y - hp);
  ctx.closePath();
  ctx.fillStyle = palette.roof;
  ctx.fill();
  ctx.strokeStyle = darken(palette.roof, 0.7);
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // windows on right wall
  const rows = Math.max(1, Math.floor(hp / 16));
  const wallW = br.x - tr.x;
  ctx.fillStyle = 'rgba(255,244,184,0.55)';
  for (let r = 1; r <= rows; r++) {
    const yOff = (r * hp) / (rows + 1);
    ctx.fillRect(tr.x + 4, tr.y - yOff - 4, Math.max(2, wallW - 8), 6);
  }

  // label
  const anchor = tileToWorld(b.tile_x + b.tile_w / 2, b.tile_y + b.tile_h / 2);
  ctx.font = '9px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillText(b.name, anchor.x + 1, br.y + 5);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(b.name, anchor.x, br.y + 4);
}

function drawAgent(
  ctx: CanvasRenderingContext2D,
  lp: { x: number; y: number },
  a: { state: string; status: string },
) {
  const p = tileToWorld(lp.x, lp.y);
  const color = a.status === 'dead' ? '#555555' : (AGENT_STATE_COLOR[a.state] ?? '#fff');
  // shadow
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 4, 7, 3, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();
  // body
  ctx.beginPath();
  ctx.arc(p.x, p.y - 4, 5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1;
  ctx.stroke();
  // head
  ctx.beginPath();
  ctx.arc(p.x, p.y - 10, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#f5d6a0';
  ctx.fill();
  ctx.stroke();
}

function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string) {
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const w = Math.min(220, ctx.measureText(text).width + 14);
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  roundRect(ctx, x - w / 2, y - 18, w, 16, 4);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(text, x, y - 6);
}

function drawFloater(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  color: string,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.font = '600 12px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawSelectionRing(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  worldPt: { x: number; y: number },
  radius = 22,
) {
  const sx = cam.x + worldPt.x * cam.scale;
  const sy = cam.y + worldPt.y * cam.scale;
  ctx.beginPath();
  ctx.arc(sx, sy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(126,231,135,0.9)';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function darken(hex: string, f: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const r = Math.floor(((n >> 16) & 0xff) * f);
  const g = Math.floor(((n >> 8) & 0xff) * f);
  const b = Math.floor((n & 0xff) * f);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
