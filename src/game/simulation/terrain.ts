import type { CityState, TerrainKind } from "@/game/types";
import { tileKey } from "./coords";

/** Deterministic hash for terrain — same seed + coords → same tile across clients. */
function hash2(seed: number, x: bigint, y: bigint): number {
  let h = BigInt(seed) ^ (x * 374761393n) ^ (y * 668265263n);
  h = (h ^ (h >> 13n)) * 1274126177n;
  return Number(h & 0xffffffffn) >>> 0;
}

/**
 * Versioned generator. Generous buildable grassland; a river near the origin;
 * scattered trees and stone piles to harvest.
 */
export function generateTerrain(
  seed: number,
  x: bigint,
  y: bigint,
  _generatorVersion = 1
): TerrainKind {
  const xi = Number(x);
  const yi = Number(y);

  // Authored river band near origin (gentle curve)
  if (Math.abs(xi + yi - 8) <= 1 && xi >= -2 && xi <= 18 && yi >= -6 && yi <= 14) {
    return "water";
  }
  if (Math.abs(xi + yi - 8) === 2 && xi >= -2 && xi <= 18 && yi >= -6 && yi <= 14) {
    return "sand";
  }

  const h = hash2(seed, x, y);
  const n = h % 1000;

  // Trees + stone piles scattered widely — harvestable, not walls
  if (n < 50) return "tree";
  if (n < 140) return "stone_pile";
  if (n < 175) return "grass_flowers";
  return "grass";
}

export function resolveTerrain(city: CityState, x: bigint, y: bigint): TerrainKind {
  const key = tileKey(x, y);
  const over = city.terrainOverrides?.[key];
  if (over) return over;
  return generateTerrain(city.seed, x, y, city.generatorVersion);
}

export function isBuildableTerrain(kind: TerrainKind): boolean {
  return kind === "grass" || kind === "grass_flowers" || kind === "path" || kind === "sand";
}

export function isWater(kind: TerrainKind): boolean {
  return kind === "water";
}

export function isHarvestable(kind: TerrainKind): kind is "tree" | "stone_pile" {
  return kind === "tree" || kind === "stone_pile";
}
