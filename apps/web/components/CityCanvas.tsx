'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useWorld } from '../lib/store';
import { TILE_W, TILE_H, tileToWorld, dayPhaseFromSimTime } from '../lib/iso';
import { generateTerrain, grassNoiseFill, TERRAIN_FILL } from '../lib/terrain';
import {
  agentLook,
  isLitWindows,
  nightTintForPhase,
  skyTopForPhase,
} from '../lib/sprite-helpers';
import TileDiamond from './sprites/TileDiamond';
import BuildingSprite from './sprites/BuildingSprite';
import AgentSprite from './sprites/AgentSprite';
import Decorations from './sprites/Decorations';

const VIEWBOX_W = 1400;
const VIEWBOX_H = 900;
const VIEWBOX_X = -700;
const VIEWBOX_Y = -450;

const STAR_FIELD = Array.from({ length: 60 }).map(() => ({
  x: Math.random() * 100,
  y: Math.random() * 60,
}));

export default function CityCanvas({ className }: { className?: string }) {
  const buildings = useWorld((s) => s.buildings);
  const agents = useWorld((s) => s.agents);
  const width = useWorld((s) => s.width);
  const height = useWorld((s) => s.height);
  const simTime = useWorld((s) => s.simTime);
  const selectedAgentId = useWorld((s) => s.selectedAgentId);
  const selectedBuildingId = useWorld((s) => s.selectedBuildingId);
  const followAgentId = useWorld((s) => s.followAgentId);
  const heatMode = useWorld((s) => s.heatMode);
  const paused = useWorld((s) => s.paused);
  const selectAgent = useWorld((s) => s.selectAgent);
  const selectBuilding = useWorld((s) => s.selectBuilding);

  const [view, setView] = useState({ scale: 1.0, x: 0, y: 60 });
  const dragging = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const [hovered, setHovered] = useState<
    { kind: 'agent' | 'building'; id: string } | null
  >(null);

  // local interpolated positions per agent — smooth movement between snapshots
  const localPos = useRef<Map<string, { x: number; y: number }>>(new Map());
  const [, force] = useState(0);
  useEffect(() => {
    let raf = 0;
    const BASE_SPEED = 0.6;
    let prev = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = (now - prev) / 1000;
      prev = now;
      const state = useWorld.getState();
      const pauseFactor = state.paused ? 0 : 1;
      const moveDelta = BASE_SPEED * state.speed * pauseFactor * dt;
      const agentsMap = state.agents;
      const map = localPos.current;
      for (const [id, a] of agentsMap) {
        let lp = map.get(id);
        if (!lp) {
          lp = { x: a.pos_x, y: a.pos_y };
          map.set(id, lp);
        }
        if (moveDelta <= 0) continue;
        const tx = a.target_x;
        const ty = a.target_y;
        const dx = tx - lp.x;
        const dy = ty - lp.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.0001) {
          const step = Math.min(dist, moveDelta);
          lp.x += (dx / dist) * step;
          lp.y += (dy / dist) * step;
        }
      }
      for (const id of Array.from(map.keys())) {
        if (!agentsMap.has(id)) map.delete(id);
      }
      force((v) => (v + 1) & 0xffff);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const groundTiles = useMemo(() => {
    const W = width || 96;
    const H = height || 96;
    const terrain = generateTerrain(W, H, 42);

    // Compute bounding box of all known buildings + padding so the ground
    // always sits under every building, regardless of where the seed places
    // them. Fall back to a fixed window if there are no buildings yet.
    let minX = W,
      minY = H,
      maxX = 0,
      maxY = 0;
    if (buildings.length > 0) {
      for (const b of buildings) {
        if (b.tile_x < minX) minX = b.tile_x;
        if (b.tile_y < minY) minY = b.tile_y;
        if (b.tile_x + b.tile_w > maxX) maxX = b.tile_x + b.tile_w;
        if (b.tile_y + b.tile_h > maxY) maxY = b.tile_y + b.tile_h;
      }
    } else {
      minX = 30;
      minY = 30;
      maxX = 66;
      maxY = 66;
    }
    const PAD = 6;
    const x0 = Math.max(0, Math.floor(minX) - PAD);
    const y0 = Math.max(0, Math.floor(minY) - PAD);
    const x1 = Math.min(W - 1, Math.ceil(maxX) + PAD);
    const y1 = Math.min(H - 1, Math.ceil(maxY) + PAD);
    const centreTx = Math.round((x0 + x1) / 2);
    const centreTy = Math.round((y0 + y1) / 2);
    const tiles: { tx: number; ty: number; fill: string }[] = [];
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const kind = terrain[ty]![tx]!;
        let fill: string;
        if (kind === 'grass') fill = grassNoiseFill(tx - centreTx, ty - centreTy);
        else fill = TERRAIN_FILL[kind] ?? '#3a5530';
        tiles.push({ tx, ty, fill });
      }
    }
    return { tiles, centreTx, centreTy };
  }, [width, height, buildings]);

  const cameraOffset = useMemo(
    () => tileToWorld(groundTiles.centreTx, groundTiles.centreTy),
    [groundTiles.centreTx, groundTiles.centreTy],
  );

  useEffect(() => {
    if (!followAgentId) return;
    const id = setInterval(() => {
      const lp = localPos.current.get(followAgentId);
      if (!lp) return;
      const p = tileToWorld(lp.x, lp.y);
      const wx = p.x - cameraOffset.x;
      const wy = p.y - cameraOffset.y;
      setView((v) => ({ ...v, x: -wx * v.scale, y: -wy * v.scale }));
    }, 200);
    return () => clearInterval(id);
  }, [followAgentId, cameraOffset.x, cameraOffset.y]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    // Don't capture — let child SVG elements receive their own click events.
    // We only set dragging state and decide pan vs click based on movement distance.
    dragging.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragging.current;
    if (!d) return;
    const cx = e.clientX;
    const cy = e.clientY;
    // Only pan if we've moved beyond a small threshold — otherwise this is a click.
    const dx = cx - d.x;
    const dy = cy - d.y;
    if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
    setView((v) => ({
      ...v,
      x: d.vx + dx,
      y: d.vy + dy,
    }));
  };
  const onPointerUp = () => {
    dragging.current = null;
  };
  const onPointerLeave = () => {
    dragging.current = null;
  };
  const onPointerCancel = () => {
    dragging.current = null;
  };
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0012;
    setView((v) => ({ ...v, scale: Math.max(0.5, Math.min(2.4, v.scale + delta)) }));
  };

  const dayPhase = dayPhaseFromSimTime(simTime);
  const tint = nightTintForPhase(dayPhase);
  const lit = isLitWindows(dayPhase);

  // wealth percentiles (recomputed on each agents update, cheap with ~30 rows)
  const wealthSorted = useMemo(() => {
    const arr = Array.from(agents.values())
      .map((a) => a.balance_cents)
      .sort((a, b) => a - b);
    return arr;
  }, [agents]);
  const wealthP20 = wealthSorted[Math.floor(wealthSorted.length * 0.2)] ?? 0;
  const wealthP80 = wealthSorted[Math.floor(wealthSorted.length * 0.8)] ?? Infinity;

  const buildingHeat = (kind: string) => {
    if (heatMode === 'crime') {
      if (kind === 'jail' || kind === 'court') return { color: '#e2536e', alpha: 0.5 };
      if (kind === 'bar' || kind === 'shop') return { color: '#e2536e', alpha: 0.25 };
    }
    if (heatMode === 'wealth') {
      if (kind === 'bank' || kind === 'house_big' || kind === 'office') return { color: '#95b876', alpha: 0.55 };
      if (kind === 'apartment') return { color: '#95b876', alpha: 0.2 };
    }
    if (heatMode === 'mood') {
      if (kind === 'park' || kind === 'cafe' || kind === 'bar') return { color: '#4ec5b8', alpha: 0.45 };
      if (kind === 'jail' || kind === 'factory') return { color: '#9b7fd1', alpha: 0.4 };
    }
    return null;
  };
  const agentHeatFor = (a: { balance_cents: number; status: string }) => {
    if (heatMode === 'wealth') {
      // top 20% richest = green, bottom 20% = violet, in-between = none
      // computed against the live agents map
      if (a.balance_cents <= 0) return { color: '#9b7fd1', alpha: 1 };
      if (a.balance_cents >= wealthP80) return { color: '#95b876', alpha: 1 };
      if (a.balance_cents <= wealthP20) return { color: '#9b7fd1', alpha: 0.85 };
    }
    if (heatMode === 'crime' && a.status === 'jailed') {
      return { color: '#e2536e', alpha: 1 };
    }
    return null;
  };

  const overlayItems = useMemo(() => {
    const now = Date.now();
    const bubbles: Array<{ id: string; x: number; y: number; text: string; alpha: number }> = [];
    const floats: Array<{ id: string; x: number; y: number; text: string; color: string; alpha: number; rise: number }> = [];
    for (const [id, a] of agents) {
      const lp = localPos.current.get(id);
      if (!lp) continue;
      const p = tileToWorld(lp.x, lp.y);
      if (a.lastBubble && a.lastBubble.expires > now) {
        bubbles.push({
          id,
          x: p.x - cameraOffset.x,
          y: p.y - cameraOffset.y,
          text: a.lastBubble.text,
          alpha: Math.min(1, (a.lastBubble.expires - now) / 4500),
        });
      }
      if (a.lastFloater && a.lastFloater.expires > now) {
        const rem = (a.lastFloater.expires - now) / 1800;
        floats.push({
          id,
          x: p.x - cameraOffset.x,
          y: p.y - cameraOffset.y,
          text: a.lastFloater.text,
          color: a.lastFloater.color,
          alpha: Math.max(0, rem),
          rise: (1 - rem) * 22,
        });
      }
    }
    return { bubbles, floats };
  }, [agents, cameraOffset.x, cameraOffset.y]);

  const skyTop = skyTopForPhase(dayPhase);
  const isNight = dayPhase < 0.18 || dayPhase > 0.85;

  return (
    <div
      className={className ?? 'absolute inset-0'}
      style={{
        cursor: dragging.current ? 'grabbing' : 'grab',
        background: '#0b0a10',
        overflow: 'hidden',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerLeave}
      onWheel={onWheel}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at 50% 35%, ${skyTop} 0%, #0b0a10 78%)`,
        }}
      />
      {isNight && (
        <div style={{ position: 'absolute', inset: 0 }}>
          {STAR_FIELD.map((s, i) => (
            <span
              key={i}
              style={{
                position: 'absolute',
                left: `${s.x}%`,
                top: `${s.y * 0.5}%`,
                width: 2,
                height: 2,
                background: '#ece6d3',
                opacity: 0.4 + Math.sin(performance.now() / 600 + i) * 0.3,
              }}
            />
          ))}
        </div>
      )}

      <svg
        width="100%"
        height="100%"
        viewBox={`${VIEWBOX_X} ${VIEWBOX_Y} ${VIEWBOX_W} ${VIEWBOX_H}`}
        style={{ position: 'absolute', inset: 0, display: 'block' }}
      >
        <g transform={`translate(${view.x}, ${view.y}) scale(${view.scale})`}>
          <g transform={`translate(${-cameraOffset.x}, ${-cameraOffset.y})`}>
            {groundTiles.tiles.map((t) => (
              <TileDiamond key={`g${t.tx},${t.ty}`} tx={t.tx} ty={t.ty} fill={t.fill} />
            ))}

            <Decorations
              width={width || 96}
              height={height || 96}
              buildings={buildings}
              lit={lit}
              nowMs={performance.now()}
            />

            {[...buildings]
              .sort((a, b) => a.tile_x + a.tile_y - (b.tile_x + b.tile_y))
              .map((b) => (
                <BuildingSprite
                  key={b.id}
                  b={{
                    id: b.id,
                    kind: b.kind,
                    name: b.name,
                    tile_x: b.tile_x,
                    tile_y: b.tile_y,
                    tile_w: b.tile_w,
                    tile_h: b.tile_h,
                  }}
                  lit={lit}
                  hovered={hovered?.kind === 'building' && hovered.id === b.id}
                  selected={selectedBuildingId === b.id}
                  heat={buildingHeat(b.kind)}
                  onClick={() => selectBuilding(b.id)}
                  onHover={(h) => setHovered(h ? { kind: 'building', id: b.id } : null)}
                />
              ))}

            {Array.from(agents.values())
              .map((a) => {
                const lp = localPos.current.get(a.id) ?? { x: a.pos_x, y: a.pos_y };
                return { a, lp };
              })
              .sort((p, q) => p.lp.x + p.lp.y - (q.lp.x + q.lp.y))
              .map(({ a, lp }) => {
                const { x, y } = tileToWorld(lp.x, lp.y);
                return (
                  <AgentSprite
                    key={a.id}
                    id={a.id}
                    x={x}
                    y={y}
                    look={agentLook(a.portrait_seed)}
                    walking={a.state === 'walking'}
                    hovered={hovered?.kind === 'agent' && hovered.id === a.id}
                    selected={selectedAgentId === a.id}
                    wanted={a.state === 'jailed' || a.status === 'jailed'}
                    heat={agentHeatFor(a)}
                    onClick={() => selectAgent(a.id)}
                    onHover={(h) => setHovered(h ? { kind: 'agent', id: a.id } : null)}
                  />
                );
              })}
          </g>
        </g>
      </svg>

      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {overlayItems.bubbles.map((b) => (
          <div
            key={`b-${b.id}`}
            className="bubble"
            style={{
              left: VIEWBOX_W / 2 + view.x + b.x * view.scale,
              top: VIEWBOX_H / 2 + view.y + (b.y - 22) * view.scale,
              opacity: b.alpha,
            }}
          >
            {b.text}
          </div>
        ))}
        {overlayItems.floats.map((f) => (
          <div
            key={`f-${f.id}`}
            className="money-float"
            style={{
              left: VIEWBOX_W / 2 + view.x + f.x * view.scale,
              top: VIEWBOX_H / 2 + view.y + (f.y - 14 - f.rise) * view.scale,
              opacity: f.alpha,
              color: f.color,
            }}
          >
            {f.text}
          </div>
        ))}
      </div>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: tint.color,
          mixBlendMode: 'multiply',
          opacity: tint.alpha,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%)',
          pointerEvents: 'none',
        }}
      />

      {paused && (
        <div
          className="pixel"
          style={{
            position: 'absolute',
            top: 88,
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#ffc26b',
            fontSize: 14,
            letterSpacing: '0.2em',
            background: 'rgba(11,10,16,0.78)',
            border: '1px solid #f0a347',
            padding: '4px 14px',
            zIndex: 18,
          }}
        >
          ◼ PAUSED
        </div>
      )}

      <div
        className="pixel"
        style={{
          position: 'absolute',
          right: 400,
          bottom: 96,
          fontSize: 9,
          color: '#8a8478',
          letterSpacing: '0.18em',
          pointerEvents: 'none',
        }}
      >
        <div style={{ marginBottom: 4 }}>N ↑</div>
        <div style={{ width: 60, height: 1, background: '#5e5868' }} />
        <div style={{ marginTop: 2 }}>{Math.round(view.scale * 100)}% · TILE {TILE_W}×{TILE_H}</div>
      </div>
    </div>
  );
}
