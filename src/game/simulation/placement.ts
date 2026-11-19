import { getBuilding } from "@/game/catalog/definitions";
import type { CityState, PlacedEntity, WorldCoord } from "@/game/types";
import { footprintTiles, rotatedFootprintSize, tileKey } from "./coords";
import { isWater, resolveTerrain } from "./terrain";
import { roadSet } from "./roads";

function entityFootprint(
  e: Pick<PlacedEntity, "x" | "y" | "rotation" | "definitionId">
): WorldCoord[] {
  const def = getBuilding(e.definitionId);
  const { w, h } = rotatedFootprintSize(def.footprint.w, def.footprint.h, e.rotation);
  return footprintTiles(e.x, e.y, w, h);
}

export function occupiedTiles(city: CityState): Set<string> {
  const set = new Set<string>();
  for (const e of city.entities) {
    if (e.stored) continue;
    for (const t of entityFootprint(e)) {
      set.add(tileKey(t.x, t.y));
    }
  }
  return set;
}

export function validatePlacement(
  city: CityState,
  definitionId: string,
  x: bigint,
  y: bigint,
  ignoreEntityId?: string,
  rotation: 0 | 90 | 180 | 270 = 0
): { ok: boolean; reason?: string; tiles: WorldCoord[] } {
  const def = getBuilding(definitionId);
  const { w, h } = rotatedFootprintSize(def.footprint.w, def.footprint.h, rotation);
  const tiles = footprintTiles(x, y, w, h);
  const occ = occupiedTiles(city);
  if (ignoreEntityId) {
    const ignore = city.entities.find((e) => e.id === ignoreEntityId);
    if (ignore && !ignore.stored) {
      for (const t of entityFootprint(ignore)) {
        occ.delete(tileKey(t.x, t.y));
      }
    }
  }
  const roads = roadSet(city.roads);

  for (const t of tiles) {
    const k = tileKey(t.x, t.y);
    const terrain = resolveTerrain(city, t.x, t.y);
    if (isWater(terrain)) {
      return { ok: false, reason: "Cannot build on water", tiles };
    }
    // Trees / stone piles are cleared when building (no separate chore).
    if (occ.has(k)) {
      return { ok: false, reason: "Tile occupied by a structure", tiles };
    }
    if (roads.has(k) && def.category !== "cosmetic") {
      return { ok: false, reason: "Tile occupied by a road", tiles };
    }
  }
  return { ok: true, tiles };
}

export function validateRoadTile(
  city: CityState,
  x: bigint,
  y: bigint
): { ok: boolean; reason?: string } {
  const terrain = resolveTerrain(city, x, y);
  if (isWater(terrain)) return { ok: false, reason: "Cannot place road on water" };
  if (terrain === "tree" || terrain === "stone_pile") {
    return { ok: false, reason: "Harvest the tree or stone first" };
  }
  const occ = occupiedTiles(city);
  if (occ.has(tileKey(x, y))) return { ok: false, reason: "Tile occupied by a structure" };
  return { ok: true };
}

export function findEntityAt(city: CityState, x: bigint, y: bigint): PlacedEntity | null {
  for (const e of city.entities) {
    if (e.stored) continue;
    const tiles = entityFootprint(e);
    if (tiles.some((t) => t.x === x && t.y === y)) return e;
  }
  return null;
}
