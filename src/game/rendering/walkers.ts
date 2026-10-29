import type { CityState, PlacedEntity } from "@/game/types";
import { getBuilding } from "@/game/catalog/definitions";
import { rotateWorld, type ViewRotation } from "@/game/simulation/coords";

/** Match isometric tile size from buildings.tsx (avoid importing JSX into unit tests). */
const TW = 64;
const TH = 32;

/** Hard cap — keeps SVG DOM tiny; animation is SMIL only (no per-frame JS). */
export const MAX_WALKERS = 8;

const SHIRT_COLORS = [
  "#E07A5F",
  "#81B29A",
  "#F2CC8F",
  "#3D405B",
  "#E9C46A",
  "#A8DADC",
  "#F4A261",
  "#90BE6D",
] as const;

export interface WalkerRoute {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  shirt: string;
  durationSec: number;
  delaySec: number;
}

function isWalkerBuilding(e: PlacedEntity): boolean {
  if (e.stored) return false;
  if (e.definitionId === "portal") return false;
  return true;
}

/** Count of placed buildings that townsfolk can walk between. */
export function countWalkerBuildings(city: CityState): number {
  return city.entities.filter(isWalkerBuilding).length;
}

/**
 * People on the map grow with buildings × happiness (via √ of the product),
 * hard-capped so cost stays negligible. Zero happiness → no walkers.
 */
export function walkerCount(city: CityState): number {
  const buildings = countWalkerBuildings(city);
  const happiness = Math.max(0, city.economy.happiness | 0);
  if (buildings < 2 || happiness <= 0) return 0;
  return Math.min(MAX_WALKERS, Math.floor(Math.sqrt(buildings * happiness)));
}

function buildingAnchor(
  e: PlacedEntity,
  rot: ViewRotation
): { sx: number; sy: number } {
  const def = getBuilding(e.definitionId);
  // Front-ish edge of footprint in view space (slightly south of NW draw origin).
  let bestVx = 0;
  let bestVy = 0;
  let bestSum = Infinity;
  for (let dx = 0; dx < def.footprint.w; dx++) {
    for (let dy = 0; dy < def.footprint.h; dy++) {
      const v = rotateWorld(Number(e.x) + dx, Number(e.y) + dy, rot);
      const sum = v.x + v.y;
      if (sum < bestSum) {
        bestSum = sum;
        bestVx = v.x;
        bestVy = v.y;
      }
    }
  }
  return {
    sx: (bestVx - bestVy) * (TW / 2),
    sy: (bestVx + bestVy) * (TH / 2) + 18,
  };
}

/** Deterministic routes between building anchors — recomputed only when city/rot changes. */
export function buildWalkerRoutes(
  city: CityState,
  rot: ViewRotation,
  count: number
): WalkerRoute[] {
  if (count <= 0) return [];
  const anchors = city.entities
    .filter(isWalkerBuilding)
    .map((e) => buildingAnchor(e, rot));
  if (anchors.length < 2) return [];

  const routes: WalkerRoute[] = [];
  for (let i = 0; i < count; i++) {
    const a = anchors[i % anchors.length]!;
    const b = anchors[(i * 3 + 1) % anchors.length]!;
    // Nudge so walkers don't stack exactly on the same line.
    const jx = ((i * 7) % 5) - 2;
    const jy = ((i * 11) % 5) - 2;
    routes.push({
      id: `w-${i}`,
      x1: a.sx + jx,
      y1: a.sy + jy,
      x2: b.sx - jx,
      y2: b.sy - jy,
      shirt: SHIRT_COLORS[i % SHIRT_COLORS.length]!,
      durationSec: 7 + (i % 5) * 1.4,
      delaySec: (i * 0.9) % 4,
    });
  }
  return routes;
}
