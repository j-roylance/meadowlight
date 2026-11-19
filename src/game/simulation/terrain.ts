import type { CityState, TerrainKind } from "@/game/types";
import { tileKey } from "./coords";
import { fbm2D, ridge2D, warpedFbm2D } from "./noise";

/**
 * Expanded biome set for visuals + harvest scatter.
 * Gameplay still collapses to TerrainKind (grass/water/sand/tree/stone/…).
 */
export type CityBiome =
  | "ocean"
  | "lake"
  | "river"
  | "beach"
  | "coast"
  | "plains"
  | "meadow"
  | "hills"
  | "forest"
  | "jungle"
  | "taiga"
  | "wetland"
  | "swamp"
  | "savanna"
  | "desert"
  | "badlands"
  | "mountain"
  | "alpine"
  | "snow";

export interface WorldSample {
  height: number;
  biome: CityBiome;
  kind: TerrainKind;
  moisture: number;
  temperature: number;
}

const MAX_HEIGHT = 12;
/** Town sits on a gentle rise — avoid crater-by-flattening. */
const STARTER_R = 24;
/**
 * Target raw height inside the starter. Kept slightly above typical
 * meadow midlands so the town reads as a plateau, not a pit.
 */
const STARTER_HEIGHT_RAW = 0.38;

function hashScatter(seed: number, x: bigint, y: bigint): number {
  let h = BigInt(seed) ^ (x * 374761393n) ^ (y * 668265263n);
  h = (h ^ (h >> 13n)) * 1274126177n;
  return Number(h & 0xffffffffn) >>> 0;
}

function starterBlend(xi: number, yi: number): number {
  const d = Math.sqrt(xi * xi + yi * yi);
  if (d >= STARTER_R) return 0;
  const t = 1 - d / STARTER_R;
  return t * t * (3 - 2 * t);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Meadow-first classification. Mountains / deserts / jungles are features,
 * not the default land cover.
 */
function pickBiome(
  height: number,
  moisture: number,
  temperature: number,
  water: "none" | "river" | "lake" | "ocean",
  peaks: number
): CityBiome {
  if (water === "ocean") return "ocean";
  if (water === "lake") return "lake";
  if (water === "river") return "river";

  if (height <= 0) {
    if (moisture > 0.62) return "swamp";
    if (temperature > 0.55) return "beach";
    return "coast";
  }

  // Tall land with ridge signal → mountain band
  if (height >= 8 && peaks > 0.58) {
    if (height >= 11 && temperature < 0.42) return "snow";
    if (height >= 10) return "alpine";
    return "mountain";
  }

  if (height >= 6 && peaks > 0.62 && moisture < 0.38 && temperature > 0.58) {
    return "badlands";
  }
  if (height >= 5 && peaks > 0.48) return "hills";

  // Climate specialties (stricter than before so meadow/plains dominate)
  if (temperature > 0.78 && moisture < 0.28) return "desert";
  if (temperature > 0.7 && moisture < 0.4) return "savanna";
  if (temperature > 0.68 && moisture > 0.78) return "jungle";
  if (temperature < 0.32 && moisture > 0.5) return "taiga";
  if (moisture > 0.8) return height <= 2 ? "swamp" : "wetland";
  if (moisture > 0.62 && temperature > 0.38 && temperature < 0.7) return "forest";

  // Default soft land
  if (moisture > 0.42 && temperature > 0.35) return "meadow";
  if (height <= 1 && moisture > 0.45) return "coast";
  return "plains";
}

/**
 * Biome-specific harvestables:
 * - mountains: stone only (no trees)
 * - meadows: flowers / grass only (no rocks)
 * - forests: trees, rare stone
 * - deserts: sand, rare stone, no trees
 */
function kindForSample(
  seed: number,
  x: bigint,
  y: bigint,
  height: number,
  biome: CityBiome
): TerrainKind {
  if (
    biome === "river" ||
    biome === "lake" ||
    biome === "ocean" ||
    (biome === "swamp" && height <= 0)
  ) {
    if (biome === "swamp") {
      const n = hashScatter(seed, x, y) % 1000;
      return n < 380 ? "water" : "grass";
    }
    return "water";
  }

  if (biome === "beach" || biome === "coast") {
    return height <= 1 ? "sand" : "grass";
  }

  const n = hashScatter(seed, x, y) % 1000;

  switch (biome) {
    case "mountain":
    case "alpine":
    case "snow":
      // Rocky peaks — no trees
      if (n < 320) return "stone_pile";
      return "grass";

    case "meadow":
      // Flowers & grass — no rocks
      if (n < 8) return "tree"; // lone shade tree
      if (n < 280) return "grass_flowers";
      return "grass";

    case "plains":
      // Open grassland — trees ok, rocks rare (meadows have none)
      if (n < 40) return "tree";
      if (n < 55) return "stone_pile";
      if (n < 150) return "grass_flowers";
      return "grass";

    case "hills":
      // Rocky rises — stones yes, trees sparse
      if (n < 25) return "tree";
      if (n < 220) return "stone_pile";
      if (n < 250) return "grass_flowers";
      return "grass";

    case "forest":
    case "taiga":
      if (n < 340) return "tree";
      if (n < 365) return "stone_pile";
      if (n < 400) return "grass_flowers";
      return "grass";

    case "jungle":
      if (n < 420) return "tree";
      if (n < 435) return "stone_pile";
      if (n < 520) return "grass_flowers";
      return "grass";

    case "wetland":
    case "swamp":
      if (n < 100) return "tree";
      if (n < 220) return "grass_flowers";
      // no stone piles in soft wetlands
      return "grass";

    case "savanna":
      if (n < 50) return "tree";
      if (n < 70) return "stone_pile";
      if (n < 110) return "grass_flowers";
      return "grass";

    case "desert":
      if (n < 40) return "stone_pile";
      return "sand";

    case "badlands":
      if (n < 160) return "stone_pile";
      return "sand";

    default:
      if (n < 40) return "tree";
      if (n < 75) return "stone_pile";
      if (n < 140) return "grass_flowers";
      return "grass";
  }
}

/**
 * Continuous height field in ~[0, 1] before quantization.
 * Low-frequency layers only — smoothness comes from the noise itself
 * (no neighbor blur: that was a ~9× cost bomb on the tile hot path).
 */
function heightFieldRaw(
  seed: number,
  xi: number,
  yi: number,
  blend: number
): { h: number; peaks: number; continental: number; basin: number; peakFeature: number } {
  const d = Math.sqrt(xi * xi + yi * yi);
  // Big relief stays off the town approach; full strength past ~55 tiles
  const reliefGate = clamp01((d - 30) / 28);

  // Lean octave counts — height is sampled for every visible tile
  const continental = warpedFbm2D(seed ^ 0xa11ce, xi * 0.0075, yi * 0.0075, 4, 0.85);
  const rolling = fbm2D(seed ^ 0xc0ffee, xi * 0.016, yi * 0.016, 3);
  const peaks = ridge2D(seed ^ 0x1117, xi * 0.013, yi * 0.013, 3);
  const basin = fbm2D(seed ^ 0x1a7e, xi * 0.02, yi * 0.02, 3);

  const peakFeature =
    Math.pow(Math.max(0, peaks - 0.52) / 0.48, 1.55) *
    reliefGate *
    (1 - blend * 0.95);
  const valleyFeature =
    Math.pow(Math.max(0, 0.42 - basin) / 0.42, 1.4) *
    (1 - Math.min(1, peakFeature * 1.2)) *
    reliefGate *
    (1 - blend * 0.9);

  let h =
    continental * 0.42 +
    rolling * 0.34 +
    peakFeature * 0.95 -
    valleyFeature * 0.55;

  h = Math.max(h, continental * 0.28 + 0.08);
  h = clamp01(h);

  if (blend > 0) {
    const plateau = STARTER_HEIGHT_RAW + blend * 0.1;
    h = h * (1 - blend) + plateau * blend;
  }

  return { h, peaks, continental, basin, peakFeature };
}

/**
 * Meadow-favoring world with broader mountains and valleys.
 * Height uses low-frequency noise only (no per-tile micro bumps / neighbor blur).
 */
export function sampleWorld(
  seed: number,
  x: bigint,
  y: bigint,
  _generatorVersion = 2
): WorldSample {
  const xi = Number(x);
  const yi = Number(y);
  const blend = starterBlend(xi, yi);

  // Bias climate toward temperate meadow band (3 octaves — enough variation)
  const moisture = clamp01(
    0.52 +
      (warpedFbm2D(seed ^ 0x50157, xi * 0.016, yi * 0.016, 3, 0.75) - 0.5) * 0.55 +
      (fbm2D(seed ^ 0x60a6, xi * 0.05, yi * 0.05, 2) - 0.5) * 0.12
  );
  const temperature = clamp01(
    0.5 +
      (warpedFbm2D(seed ^ 0x7e1a, xi * 0.013, yi * 0.013, 3, 0.55) - 0.5) * 0.5 -
      Math.abs(yi) * 0.0009 +
      (fbm2D(seed ^ 0x71c1, xi * 0.04, yi * 0.04, 2) - 0.5) * 0.08
  );

  const { h, peaks, continental, basin, peakFeature } = heightFieldRaw(
    seed,
    xi,
    yi,
    blend
  );

  const riverRidge = ridge2D(seed ^ 0x314e, xi * 0.02, yi * 0.02, 3);
  const riverMask =
    riverRidge > 0.84 &&
    continental > 0.32 &&
    continental < 0.75 &&
    peakFeature < 0.4;

  const lakeMask =
    !riverMask &&
    basin < 0.2 &&
    moisture > 0.58 &&
    continental > 0.3 &&
    continental < 0.62 &&
    peakFeature < 0.25;

  const oceanMask =
    continental < 0.18 && peakFeature < 0.15 && !lakeMask && blend < 0.15;

  const originRiver =
    Math.abs(xi + yi - 26) <= 0 &&
    xi >= 18 &&
    xi <= 28 &&
    yi >= -4 &&
    yi <= 12;

  let water: "none" | "river" | "lake" | "ocean" = "none";
  if (oceanMask) water = "ocean";
  else if (lakeMask) water = "lake";
  else if (riverMask || (originRiver && blend > 0.05 && blend < 0.85)) water = "river";

  if (blend > 0 && !(originRiver && blend > 0.05 && blend < 0.85)) {
    water = "none";
  }

  const shaped = clamp01(0.04 + h * 0.72 + peakFeature * 0.38);
  let height = Math.floor(Math.pow(shaped, 0.92) * (MAX_HEIGHT + 1));
  height = Math.max(0, Math.min(MAX_HEIGHT, height));

  if (water !== "none") {
    height = water === "ocean" ? 0 : Math.min(height, 1);
  }

  // Soft town green — keep the approach gentle; big relief waits farther out
  const TOWN_H = 4;
  const d = Math.sqrt(xi * xi + yi * yi);
  if (blend > 0.35) {
    height = TOWN_H;
  } else if (d < STARTER_R * 1.85) {
    const skirt = 1 - d / (STARTER_R * 1.85);
    const eased = skirt * skirt * (3 - 2 * skirt);
    const cap = TOWN_H + (d > STARTER_R ? 1 : 0) + (d > STARTER_R * 1.4 ? 1 : 0);
    height = Math.min(height, cap);
    if (eased > 0.12) {
      height = Math.round(height * (1 - eased) + TOWN_H * eased);
    }
  }

  let biome = pickBiome(height, moisture, temperature, water, peaks);

  // Bank check only where rivers are plausible — avoid 4× ridge samples everywhere
  if (water === "none" && height <= 3 && continental > 0.3 && continental < 0.78) {
    const bank =
      ridge2D(seed ^ 0x314e, (xi + 1) * 0.02, yi * 0.02, 3) > 0.84 ||
      ridge2D(seed ^ 0x314e, (xi - 1) * 0.02, yi * 0.02, 3) > 0.84 ||
      ridge2D(seed ^ 0x314e, xi * 0.02, (yi + 1) * 0.02, 3) > 0.84 ||
      ridge2D(seed ^ 0x314e, xi * 0.02, (yi - 1) * 0.02, 3) > 0.84;
    if (bank) biome = moisture > 0.5 ? "coast" : "beach";
  }

  // Town + approach are meadow country — no rocky biomes in the starter view
  if (d < STARTER_R * 1.35) {
    if (biome === "river" || biome === "coast" || biome === "beach") {
      // keep scenic water edges
    } else if (
      moisture > 0.6 &&
      temperature > 0.4 &&
      temperature < 0.72 &&
      d > STARTER_R * 0.55
    ) {
      biome = "forest";
    } else if (moisture > 0.38) {
      biome = "meadow";
    } else {
      biome = "plains";
    }
  }

  const kind = kindForSample(seed, x, y, height, biome);

  return {
    height: kind === "water" ? 0 : height,
    biome,
    kind,
    moisture,
    temperature,
  };
}

export function generateTerrain(
  seed: number,
  x: bigint,
  y: bigint,
  generatorVersion = 2
): TerrainKind {
  return sampleWorld(seed, x, y, generatorVersion).kind;
}

export function resolveTerrain(city: CityState, x: bigint, y: bigint): TerrainKind {
  const key = tileKey(x, y);
  const over = city.terrainOverrides?.[key];
  if (over) return over;
  return generateTerrain(city.seed, x, y, city.generatorVersion);
}

export function resolveWorldSample(city: CityState, x: bigint, y: bigint): WorldSample {
  const base = sampleWorld(city.seed, x, y, city.generatorVersion);
  const key = tileKey(x, y);
  const over = city.terrainOverrides?.[key];
  if (over) return { ...base, kind: over };
  return base;
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
