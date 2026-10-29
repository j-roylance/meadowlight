import { v4 as uuid } from "uuid";
import type { CityState, Resources } from "@/game/types";
import { HARVEST_STONE, HARVEST_WOOD } from "@/game/types";
import { spendAction, canSpendAction } from "./actions";
import { credit } from "./economy";
import { occupiedTiles } from "./placement";
import { roadSet } from "./roads";
import { tileKey } from "./coords";
import { isHarvestable, resolveTerrain } from "./terrain";

export function tryHarvest(
  city: CityState,
  x: bigint,
  y: bigint,
  now: number
): { ok: true; city: CityState; grant: Resources; label: string } | { ok: false; error: string } {
  if (!canSpendAction(city.economy)) {
    return { ok: false, error: "No actions remaining" };
  }
  const key = tileKey(x, y);
  if (occupiedTiles(city).has(key)) {
    return { ok: false, error: "Tile occupied" };
  }
  if (roadSet(city.roads).has(key)) {
    return { ok: false, error: "Cannot harvest a road" };
  }
  const kind = resolveTerrain(city, x, y);
  if (!isHarvestable(kind)) {
    return { ok: false, error: "Nothing to harvest here" };
  }

  const grant: Resources = { coins: 0, wood: 0, stone: 0, research: 0 , happiness: 0 };
  let label: string;
  if (kind === "tree") {
    grant.wood = HARVEST_WOOD;
    label = `Chopped a tree for ${HARVEST_WOOD} wood.`;
  } else {
    grant.stone = HARVEST_STONE;
    label = `Gathered a stone pile for ${HARVEST_STONE} stone.`;
  }

  const overrides = { ...(city.terrainOverrides ?? {}) };
  overrides[key] = "grass";

  const next: CityState = {
    ...city,
    economy: spendAction(credit(city.economy, grant)),
    terrainOverrides: overrides,
    revision: city.revision + 1,
    activity: [
      { id: uuid(), at: now, kind: "harvest", message: label },
      ...city.activity,
    ].slice(0, 40),
  };
  return { ok: true, city: next, grant, label };
}

/** Clear harvestables under a footprint when placing a building. */
export function clearHarvestablesUnder(
  city: CityState,
  tiles: { x: bigint; y: bigint }[]
): Record<string, import("@/game/types").TerrainKind> {
  const overrides = { ...(city.terrainOverrides ?? {}) };
  for (const t of tiles) {
    const kind = resolveTerrain({ ...city, terrainOverrides: overrides }, t.x, t.y);
    if (kind === "tree" || kind === "stone_pile") {
      overrides[tileKey(t.x, t.y)] = "grass";
    }
  }
  return overrides;
}
