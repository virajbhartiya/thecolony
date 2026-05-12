export type Tile = { x: number; y: number };

interface Node extends Tile {
  g: number;
  f: number;
  parent?: Node;
}

function key(x: number, y: number): number {
  return y * 4096 + x;
}

export function findPath(
  start: Tile,
  goal: Tile,
  passable: (x: number, y: number) => boolean,
  width: number,
  height: number,
  maxSteps = 4096,
): Tile[] {
  if (start.x === goal.x && start.y === goal.y) return [start];
  const open = new Map<number, Node>();
  const closed = new Set<number>();
  const startNode: Node = { ...start, g: 0, f: heuristic(start, goal) };
  open.set(key(start.x, start.y), startNode);
  let steps = 0;

  while (open.size > 0 && steps++ < maxSteps) {
    let curr: Node | null = null;
    for (const n of open.values()) if (!curr || n.f < curr.f) curr = n;
    if (!curr) break;
    if (curr.x === goal.x && curr.y === goal.y) return reconstruct(curr);
    open.delete(key(curr.x, curr.y));
    closed.add(key(curr.x, curr.y));
    for (const [dx, dy] of NEIGHBORS) {
      const nx = curr.x + dx;
      const ny = curr.y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (closed.has(key(nx, ny))) continue;
      if (!(nx === goal.x && ny === goal.y) && !passable(nx, ny)) continue;
      const ng = curr.g + (dx !== 0 && dy !== 0 ? 1.414 : 1);
      const k = key(nx, ny);
      const existing = open.get(k);
      if (!existing || ng < existing.g) {
        open.set(k, { x: nx, y: ny, g: ng, f: ng + heuristic({ x: nx, y: ny }, goal), parent: curr });
      }
    }
  }
  return [];
}

const NEIGHBORS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

function heuristic(a: Tile, b: Tile): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

function reconstruct(end: Node): Tile[] {
  const path: Tile[] = [];
  let n: Node | undefined = end;
  while (n) {
    path.push({ x: n.x, y: n.y });
    n = n.parent;
  }
  return path.reverse();
}
