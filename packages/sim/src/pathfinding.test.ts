import assert from 'node:assert/strict';
import test from 'node:test';
import { findPath, type Tile } from './pathfinding';

function walkable(width: number, height: number, blocked: Tile[] = []) {
  const blockedKeys = new Set(blocked.map((p) => `${p.x},${p.y}`));
  return {
    passable: (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && !blockedKeys.has(`${x},${y}`),
    blockedKeys,
  };
}

function assertAdjacent(path: Tile[]) {
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1]!;
    const curr = path[i]!;
    assert.ok(Math.abs(prev.x - curr.x) <= 1, `x jump at ${i}`);
    assert.ok(Math.abs(prev.y - curr.y) <= 1, `y jump at ${i}`);
    assert.notDeepEqual(prev, curr, `duplicate step at ${i}`);
  }
}

test('returns the start tile when already at the goal', () => {
  const { passable } = walkable(4, 4);
  assert.deepEqual(findPath({ x: 2, y: 2 }, { x: 2, y: 2 }, passable, 4, 4), [{ x: 2, y: 2 }]);
});

test('finds a direct horizontal path', () => {
  const { passable } = walkable(5, 3);
  const path = findPath({ x: 0, y: 1 }, { x: 4, y: 1 }, passable, 5, 3);
  assert.deepEqual(path[0], { x: 0, y: 1 });
  assert.deepEqual(path.at(-1), { x: 4, y: 1 });
  assertAdjacent(path);
});

test('uses diagonal movement when it is the shortest route', () => {
  const { passable } = walkable(4, 4);
  const path = findPath({ x: 0, y: 0 }, { x: 3, y: 3 }, passable, 4, 4);
  assert.deepEqual(path, [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 2 },
    { x: 3, y: 3 },
  ]);
});

test('routes around blocked tiles', () => {
  const { passable, blockedKeys } = walkable(5, 5, [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
  ]);
  const path = findPath({ x: 0, y: 1 }, { x: 4, y: 1 }, passable, 5, 5);
  assert.deepEqual(path[0], { x: 0, y: 1 });
  assert.deepEqual(path.at(-1), { x: 4, y: 1 });
  assertAdjacent(path);
  for (const p of path) assert.equal(blockedKeys.has(`${p.x},${p.y}`), false);
});

test('allows entering an otherwise blocked goal tile', () => {
  const { passable } = walkable(4, 4, [{ x: 3, y: 3 }]);
  const path = findPath({ x: 0, y: 0 }, { x: 3, y: 3 }, passable, 4, 4);
  assert.deepEqual(path.at(-1), { x: 3, y: 3 });
  assertAdjacent(path);
});

test('returns an empty path when the goal is unreachable', () => {
  const { passable } = walkable(3, 3, [
    { x: 0, y: 1 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ]);
  assert.deepEqual(findPath({ x: 0, y: 0 }, { x: 2, y: 2 }, passable, 3, 3), []);
});
