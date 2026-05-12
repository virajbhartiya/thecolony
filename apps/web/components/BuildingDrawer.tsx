'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { useWorld } from '../lib/store';

export default function BuildingDrawer() {
  const id = useWorld((s) => s.selectedBuildingId);
  const buildings = useWorld((s) => s.buildings);
  const agents = useWorld((s) => s.agents);
  const select = useWorld((s) => s.selectBuilding);
  const selectAgent = useWorld((s) => s.selectAgent);

  const building = useMemo(
    () => (id ? buildings.find((b) => b.id === id) ?? null : null),
    [id, buildings],
  );

  const occupants = useMemo(() => {
    if (!building) return [];
    return Array.from(agents.values()).filter((a) => isInBuilding(a, building));
  }, [agents, building]);

  if (!id || !building) return null;

  return (
    <div className="drawer-panel pointer-events-auto absolute bottom-3 left-3 right-3 top-28 z-20 flex flex-col overflow-hidden sm:left-4 sm:right-auto sm:top-24 sm:w-[340px] lg:bottom-4">
      <header className="panel-header flex items-start gap-3 p-3">
        <div className="flex-1">
          <p className="panel-tag">{building.kind}</p>
          <h2 className="text-base font-medium">{building.name}</h2>
          <p className="text-xs text-zinc-400">
            zone: {building.zone_kind} · {building.tile_w}×{building.tile_h} · capacity {building.capacity}
            {building.rent_cents ? ` · rent $${(building.rent_cents / 100).toFixed(0)}/day` : ''}
          </p>
        </div>
        <button
          onClick={() => select(null)}
          className="border border-[var(--line)] bg-[var(--ink-2)] px-2 py-1 text-sm text-[var(--cream-dim)] transition-colors hover:bg-[var(--ink-3)] hover:text-[var(--amber-2)]"
        >
          ✕
        </button>
      </header>
      <div className="flex-1 overflow-y-auto p-3 text-sm">
        <Link
          href={`/building/${building.id}`}
          className="mb-3 block border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-center text-xs uppercase text-sky-200 hover:bg-sky-500/15"
        >
          Full dossier
        </Link>
        <h3 className="text-[10px] uppercase text-zinc-500 mb-2">Inside now</h3>
        {occupants.length === 0 && <p className="text-zinc-500 text-xs">Empty.</p>}
        <div className="space-y-1">
          {occupants.map((a) => (
            <button
              key={a.id}
              onClick={() => selectAgent(a.id)}
              className="block w-full text-left text-xs px-2 py-1 rounded hover:bg-white/5"
            >
              <span className="font-medium">{a.name}</span>
              <span className="text-zinc-500"> · {a.state}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function isInBuilding(
  a: { pos_x: number; pos_y: number },
  b: { tile_x: number; tile_y: number; tile_w: number; tile_h: number },
): boolean {
  return (
    a.pos_x >= b.tile_x &&
    a.pos_x <= b.tile_x + b.tile_w &&
    a.pos_y >= b.tile_y &&
    a.pos_y <= b.tile_y + b.tile_h
  );
}
