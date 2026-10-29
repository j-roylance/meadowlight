import { MAX_ROAD_PATH, type RoadTile, type WorldCoord } from "@/game/types";
import { tileKey } from "./coords";

export function isOrthogonalPath(tiles: WorldCoord[]): boolean {
  if (tiles.length === 0) return false;
  for (let i = 1; i < tiles.length; i++) {
    const dx = tiles[i].x - tiles[i - 1].x;
    const dy = tiles[i].y - tiles[i - 1].y;
    const adx = dx < 0n ? -dx : dx;
    const ady = dy < 0n ? -dy : dy;
    if (!((adx === 1n && ady === 0n) || (adx === 0n && ady === 1n))) {
      return false;
    }
  }
  return true;
}

export function validateRoadPath(
  path: WorldCoord[],
  existing: Set<string>
): { ok: boolean; error?: string; newTiles: WorldCoord[]; stoneCost: number } {
  if (path.length === 0) return { ok: false, error: "Empty path", newTiles: [], stoneCost: 0 };
  if (path.length > MAX_ROAD_PATH) {
    return {
      ok: false,
      error: `Path exceeds ${MAX_ROAD_PATH} tiles`,
      newTiles: [],
      stoneCost: 0,
    };
  }
  if (!isOrthogonalPath(path)) {
    return { ok: false, error: "Path must be continuous and orthogonal", newTiles: [], stoneCost: 0 };
  }
  const seen = new Set<string>();
  for (const t of path) {
    const k = tileKey(t.x, t.y);
    if (seen.has(k)) {
      return { ok: false, error: "Path revisits a tile", newTiles: [], stoneCost: 0 };
    }
    seen.add(k);
  }
  const newTiles = path.filter((t) => !existing.has(tileKey(t.x, t.y)));
  return { ok: true, newTiles, stoneCost: newTiles.length };
}

/** Auto-mask for road junctions from 4-neighbors. */
export function roadMask(
  x: bigint,
  y: bigint,
  roads: Set<string>
): { n: boolean; e: boolean; s: boolean; w: boolean } {
  return {
    n: roads.has(tileKey(x, y - 1n)),
    e: roads.has(tileKey(x + 1n, y)),
    s: roads.has(tileKey(x, y + 1n)),
    w: roads.has(tileKey(x - 1n, y)),
  };
}

export function roadSet(roads: RoadTile[]): Set<string> {
  return new Set(roads.map((r) => tileKey(r.x, r.y)));
}
