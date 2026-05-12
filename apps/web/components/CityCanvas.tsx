'use client';
import { useEffect, useRef } from 'react';
import { useWorld } from '../lib/store';
import { tileToWorld, TILE_W, TILE_H } from '../lib/iso';
import { generateTerrain } from '../lib/terrain';

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2.5;

const TERRAIN_COLORS: Record<string, number> = {
  grass: 0x4d7a3a,
  road: 0x3a3a44,
  water: 0x2a55a8,
  sand: 0xcdb87a,
  plaza: 0x7a7363,
  sidewalk: 0x6c6c7a,
};

const BUILDING_PALETTE: Record<string, { roof: number; wall: number; height: number }> = {
  house: { roof: 0xb6614a, wall: 0xcfb18a, height: 24 },
  apartment: { roof: 0x9a5a76, wall: 0xd9c2a3, height: 56 },
  shop: { roof: 0xdba14a, wall: 0xe6d9b6, height: 28 },
  factory: { roof: 0x4a4f5a, wall: 0x8d8d97, height: 44 },
  farm: { roof: 0x6e4a2a, wall: 0xc6a36c, height: 18 },
  bar: { roof: 0x5a3c66, wall: 0xb88fb1, height: 26 },
  office: { roof: 0x3a3f5a, wall: 0xb8c1e0, height: 60 },
  bank: { roof: 0x222a44, wall: 0xd4c8a4, height: 50 },
  court: { roof: 0x5c5247, wall: 0xeae2cf, height: 46 },
  jail: { roof: 0x2a2a2a, wall: 0x7a7670, height: 32 },
  temple: { roof: 0xe0c266, wall: 0xeae0bd, height: 60 },
  town_hall: { roof: 0xcab36a, wall: 0xeadcb0, height: 56 },
  water_works: { roof: 0x355a7a, wall: 0xa0b8c8, height: 32 },
  power_plant: { roof: 0x4a3a2a, wall: 0x988877, height: 40 },
};

const AGENT_STATE_COLOR: Record<string, number> = {
  idle: 0xa3e0b6,
  walking: 0x7ee787,
  working: 0xf5d265,
  sleeping: 0x7ea3e0,
  eating: 0xe07e9c,
  speaking: 0xe0c87e,
  jailed: 0xf85149,
  dead: 0x555555,
};

interface Props {
  className?: string;
}

export default function CityCanvas({ className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<unknown | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    const boot = async () => {
      const PIXI = await import('pixi.js');
      if (cancelled || !containerRef.current) return;

      const app = new PIXI.Application();
      await app.init({
        background: '#0a0d14',
        resizeTo: containerRef.current,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(2, window.devicePixelRatio || 1),
      });
      containerRef.current.appendChild(app.canvas);
      appRef.current = app;

      // world root for pan/zoom
      const world = new PIXI.Container();
      app.stage.addChild(world);

      const terrainLayer = new PIXI.Container();
      const roadLayer = new PIXI.Container();
      const buildingLayer = new PIXI.Container();
      const agentLayer = new PIXI.Container();
      const overlayLayer = new PIXI.Container();
      world.addChild(terrainLayer, roadLayer, buildingLayer, agentLayer, overlayLayer);

      // initial center
      const center = () => {
        const c = tileToWorld(48, 48);
        world.x = app.renderer.width / 2 - c.x * world.scale.x;
        world.y = app.renderer.height / 2 - c.y * world.scale.y;
      };
      world.scale.set(0.85);
      center();

      // ----- terrain ----------------------------------------------------
      const state = useWorld.getState();
      const W = state.width || 96;
      const H = state.height || 96;
      const terrain = generateTerrain(W, H, 42);
      drawTerrain(PIXI, terrainLayer, terrain, W, H);

      // ----- buildings --------------------------------------------------
      const buildingSprites = new Map<string, { container: any; height: number }>();
      function syncBuildings() {
        const buildings = useWorld.getState().buildings;
        const seen = new Set<string>();
        for (const b of buildings) {
          seen.add(b.id);
          if (buildingSprites.has(b.id)) continue;
          const container = drawBuilding(PIXI, b);
          container.eventMode = 'static';
          container.cursor = 'pointer';
          (container as any).buildingId = b.id;
          container.on('pointertap', () => useWorld.getState().selectBuilding(b.id));
          buildingLayer.addChild(container);
          buildingSprites.set(b.id, { container, height: BUILDING_PALETTE[b.kind]?.height ?? 30 });
        }
        for (const id of Array.from(buildingSprites.keys())) {
          if (!seen.has(id)) {
            const s = buildingSprites.get(id);
            if (s) buildingLayer.removeChild(s.container);
            buildingSprites.delete(id);
          }
        }
        sortIso(buildingLayer);
      }

      // ----- agents -----------------------------------------------------
      interface AgentSprite {
        container: any;
        body: any;
        nameLabel: any;
        bubble: any;
        floater: any;
      }
      const agentSprites = new Map<string, AgentSprite>();

      function makeAgentSprite(id: string, name: string) {
        const c = new PIXI.Container();
        c.eventMode = 'static';
        c.cursor = 'pointer';
        const body = new PIXI.Graphics();
        c.addChild(body);
        const nameLabel = new PIXI.Text({
          text: name,
          style: { fontFamily: 'Inter', fontSize: 10, fill: 0xffffff, stroke: { color: 0x000000, width: 3 } },
        });
        nameLabel.anchor.set(0.5, 1);
        nameLabel.position.set(0, -16);
        nameLabel.visible = false;
        c.addChild(nameLabel);
        const bubble = new PIXI.Text({
          text: '',
          style: {
            fontFamily: 'Inter',
            fontSize: 11,
            fill: 0x111111,
            wordWrap: true,
            wordWrapWidth: 180,
            align: 'left',
          },
        });
        bubble.anchor.set(0.5, 1);
        bubble.position.set(0, -30);
        bubble.visible = false;
        c.addChild(bubble);
        const floater = new PIXI.Text({
          text: '',
          style: {
            fontFamily: 'Inter',
            fontSize: 12,
            fontWeight: '600',
            fill: 0x7ee787,
            stroke: { color: 0x000000, width: 3 },
          },
        });
        floater.anchor.set(0.5, 1);
        floater.position.set(0, -22);
        floater.visible = false;
        c.addChild(floater);
        c.on('pointerover', () => { nameLabel.visible = true; });
        c.on('pointerout', () => { nameLabel.visible = false; });
        c.on('pointertap', () => useWorld.getState().selectAgent(id));
        return { container: c, body, nameLabel, bubble, floater };
      }

      function syncAgents() {
        const agents = useWorld.getState().agents;
        const seen = new Set<string>();
        for (const [id, a] of agents) {
          seen.add(id);
          let s = agentSprites.get(id);
          if (!s) {
            s = makeAgentSprite(id, a.name);
            agentLayer.addChild(s.container);
            agentSprites.set(id, s);
          }
        }
        for (const id of Array.from(agentSprites.keys())) {
          if (!seen.has(id)) {
            const s = agentSprites.get(id);
            if (s) agentLayer.removeChild(s.container);
            agentSprites.delete(id);
          }
        }
      }

      // ----- pan / zoom -------------------------------------------------
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      const canvas = app.canvas;
      canvas.addEventListener('pointerdown', (ev: PointerEvent) => {
        dragging = true;
        lastX = ev.clientX;
        lastY = ev.clientY;
        canvas.setPointerCapture(ev.pointerId);
      });
      canvas.addEventListener('pointermove', (ev: PointerEvent) => {
        if (!dragging) return;
        world.x += ev.clientX - lastX;
        world.y += ev.clientY - lastY;
        lastX = ev.clientX;
        lastY = ev.clientY;
        useWorld.setState({ followAgentId: null });
      });
      canvas.addEventListener('pointerup', () => {
        dragging = false;
      });
      canvas.addEventListener('wheel', (ev: WheelEvent) => {
        ev.preventDefault();
        const delta = ev.deltaY < 0 ? 1.1 : 0.9;
        const ns = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, world.scale.x * delta));
        const rect = canvas.getBoundingClientRect();
        const mx = ev.clientX - rect.left;
        const my = ev.clientY - rect.top;
        // zoom toward cursor
        const wx = (mx - world.x) / world.scale.x;
        const wy = (my - world.y) / world.scale.y;
        world.scale.set(ns);
        world.x = mx - wx * ns;
        world.y = my - wy * ns;
      }, { passive: false });

      // ----- keyboard ---------------------------------------------------
      const keys = new Set<string>();
      window.addEventListener('keydown', (ev) => keys.add(ev.key.toLowerCase()));
      window.addEventListener('keyup', (ev) => keys.delete(ev.key.toLowerCase()));

      // ----- main loop --------------------------------------------------
      const SPEED_TILES_PER_SEC = 0.6;
      let lastFrame = performance.now();

      app.ticker.add(() => {
        const now = performance.now();
        const dt = (now - lastFrame) / 1000;
        lastFrame = now;

        // pan with WASD
        const PAN_SPEED = 600 * dt;
        if (keys.has('w') || keys.has('arrowup')) world.y += PAN_SPEED;
        if (keys.has('s') || keys.has('arrowdown')) world.y -= PAN_SPEED;
        if (keys.has('a') || keys.has('arrowleft')) world.x += PAN_SPEED;
        if (keys.has('d') || keys.has('arrowright')) world.x -= PAN_SPEED;

        syncBuildings();
        syncAgents();

        // interpolate agents
        const agents = useWorld.getState().agents;
        const nowMs = Date.now();
        const moveDelta = SPEED_TILES_PER_SEC * dt;
        for (const [id, a] of agents) {
          const s = agentSprites.get(id);
          if (!s) continue;
          // step pos toward target locally for smoothness
          const dx = a.target_x - a.pos_x;
          const dy = a.target_y - a.pos_y;
          const dist = Math.hypot(dx, dy);
          if (dist > 0.0001) {
            const stepLen = Math.min(dist, moveDelta);
            a.pos_x += (dx / dist) * stepLen;
            a.pos_y += (dy / dist) * stepLen;
          }
          const p = tileToWorld(a.pos_x, a.pos_y);
          s.container.position.set(p.x, p.y);
          drawAgentBody(PIXI, s.body, a.state, a.status);

          // bubble
          if (a.lastBubble && a.lastBubble.expires > nowMs) {
            if (s.bubble.text !== a.lastBubble.text) s.bubble.text = a.lastBubble.text;
            s.bubble.visible = true;
          } else {
            s.bubble.visible = false;
          }
          // floater
          if (a.lastFloater && a.lastFloater.expires > nowMs) {
            if (s.floater.text !== a.lastFloater.text) s.floater.text = a.lastFloater.text;
            (s.floater.style as any).fill = a.lastFloater.color;
            const remaining = (a.lastFloater.expires - nowMs) / 1800;
            s.floater.alpha = remaining;
            s.floater.position.y = -22 - (1 - remaining) * 16;
            s.floater.visible = true;
          } else {
            s.floater.visible = false;
          }
        }

        sortIso(agentLayer);

        // follow camera
        const followId = useWorld.getState().followAgentId;
        if (followId) {
          const a = useWorld.getState().agents.get(followId);
          if (a) {
            const p = tileToWorld(a.pos_x, a.pos_y);
            world.x = app.renderer.width / 2 - p.x * world.scale.x;
            world.y = app.renderer.height / 2 - p.y * world.scale.y;
          }
        }

        // day/night tint applied via stage filter (cheap)
        const hour = (Date.now() / 1000 / 60) % 24; // 1 min == 1 sim hour
        const isNight = hour < 6 || hour > 20;
        const dimAmount = isNight ? 0.55 : 1.0;
        // overlay rectangle as cheap tint
        if (!(overlayLayer as any)._tint) {
          const r = new PIXI.Graphics();
          (overlayLayer as any)._tint = r;
          overlayLayer.addChild(r);
        }
        const tintG: any = (overlayLayer as any)._tint;
        tintG.clear();
        if (isNight) {
          tintG.rect(-5000, -5000, 10000, 10000).fill({ color: 0x0a1230, alpha: 0.32 });
        }
        void dimAmount;
      });
    };

    boot();
    return () => {
      cancelled = true;
      const app: any = appRef.current;
      if (app) {
        try {
          app.destroy(true, { children: true });
        } catch {
          /* noop */
        }
      }
      appRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className={className ?? 'absolute inset-0'} />;
}

function drawTerrain(PIXI: any, layer: any, terrain: string[][], W: number, H: number) {
  // batch into a single Graphics for perf
  const g = new PIXI.Graphics();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const kind = terrain[y]![x];
      const color = TERRAIN_COLORS[kind] ?? 0x333333;
      const p = tileToWorld(x, y);
      g.poly([
        p.x, p.y - TILE_H / 2,
        p.x + TILE_W / 2, p.y,
        p.x, p.y + TILE_H / 2,
        p.x - TILE_W / 2, p.y,
      ]).fill(color);
    }
  }
  // subtle water shimmer via overlay rects (cheap)
  layer.addChild(g);
}

function drawBuilding(PIXI: any, b: any): any {
  const palette = BUILDING_PALETTE[b.kind] ?? BUILDING_PALETTE.house!;
  const c = new PIXI.Container();
  const w = b.tile_w;
  const h = b.tile_h;
  const hp = palette.height;

  // base footprint - dark base
  const base = new PIXI.Graphics();
  const corners = footprintCorners(b.tile_x, b.tile_y, w, h);
  base.poly(corners.flatMap((p) => [p.x, p.y])).fill({ color: 0x0a0a0e, alpha: 0.4 });
  c.addChild(base);

  // walls (4 visible sides — front-right and back-right shown in iso)
  const walls = new PIXI.Graphics();
  // right wall
  const tl = corners[0]!;
  const tr = corners[1]!;
  const br = corners[2]!;
  const bl = corners[3]!;
  walls
    .poly([tr.x, tr.y, tr.x, tr.y - hp, br.x, br.y - hp, br.x, br.y])
    .fill(palette.wall);
  walls
    .poly([br.x, br.y, br.x, br.y - hp, bl.x, bl.y - hp, bl.x, bl.y])
    .fill(darken(palette.wall, 0.78));
  c.addChild(walls);

  // roof
  const roof = new PIXI.Graphics();
  roof
    .poly([
      tl.x, tl.y - hp,
      tr.x, tr.y - hp,
      br.x, br.y - hp,
      bl.x, bl.y - hp,
    ])
    .fill(palette.roof);
  c.addChild(roof);

  // windows on right wall
  const windows = new PIXI.Graphics();
  const cols = Math.max(1, Math.floor(hp / 14));
  const rows = Math.max(1, Math.floor(Math.abs(tr.x - br.x) / 16) || 1);
  void rows;
  for (let row = 1; row <= cols; row++) {
    const yOff = (row * hp) / (cols + 1);
    windows
      .rect(tr.x + 4, tr.y - yOff - 4, Math.max(2, (br.x - tr.x) - 8), 6)
      .fill({ color: 0xfff4b8, alpha: 0.55 });
  }
  c.addChild(windows);

  // depth sort hint — anchor to building center
  const anchor = tileToWorld(b.tile_x + w / 2, b.tile_y + h / 2);
  c.position.set(0, 0);
  (c as any).isoDepth = anchor.y;

  // name label hovers? small label below
  const label = new PIXI.Text({
    text: b.name,
    style: { fontFamily: 'Inter', fontSize: 9, fill: 0xffffff, stroke: { color: 0x000000, width: 2 } },
  });
  label.anchor.set(0.5, 0);
  label.position.set(anchor.x, br.y + 4);
  label.alpha = 0.7;
  c.addChild(label);

  return c;
}

function footprintCorners(tx: number, ty: number, w: number, h: number) {
  return [
    tileToWorld(tx, ty),
    tileToWorld(tx + w, ty),
    tileToWorld(tx + w, ty + h),
    tileToWorld(tx, ty + h),
  ];
}

function darken(hex: number, factor: number): number {
  const r = Math.floor(((hex >> 16) & 0xff) * factor);
  const g = Math.floor(((hex >> 8) & 0xff) * factor);
  const b = Math.floor((hex & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

function drawAgentBody(_PIXI: any, g: any, state: string, status: string) {
  g.clear();
  const color = status === 'dead' ? 0x555555 : AGENT_STATE_COLOR[state] ?? 0xffffff;
  // shadow
  g.ellipse(0, 4, 7, 3).fill({ color: 0x000000, alpha: 0.4 });
  // body
  g.circle(0, -4, 5).fill(color).stroke({ color: 0x111111, width: 1 });
  // head
  g.circle(0, -10, 3).fill(0xf5d6a0).stroke({ color: 0x111111, width: 1 });
}

function sortIso(layer: any) {
  layer.children.sort((a: any, b: any) => {
    const ay = a.isoDepth ?? a.y;
    const by = b.isoDepth ?? b.y;
    return ay - by;
  });
}
