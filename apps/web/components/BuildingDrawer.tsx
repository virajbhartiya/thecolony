'use client';
import { useMemo } from 'react';
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
    <div className="pointer-events-auto absolute right-4 top-4 bottom-4 z-20 w-[320px] glass rounded-lg flex flex-col">
      <header className="flex items-start gap-3 p-3 border-b border-white/5">
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">{building.kind}</p>
          <h2 className="text-base font-medium">{building.name}</h2>
          <p className="text-xs text-zinc-400">
            zone: {building.zone_kind} · {building.tile_w}×{building.tile_h} · capacity {building.capacity}
            {building.rent_cents ? ` · rent $${(building.rent_cents / 100).toFixed(0)}/day` : ''}
          </p>
        </div>
        <button
          onClick={() => select(null)}
          className="text-zinc-400 hover:text-zinc-100 transition-colors px-2 py-1 text-sm"
        >
          ✕
        </button>
      </header>
      <div className="flex-1 overflow-y-auto p-3 text-sm">
        <h3 className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Inside now</h3>
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
