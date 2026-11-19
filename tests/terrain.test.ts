import { describe, expect, it } from "vitest";
import {
  generateTerrain,
  isBuildableTerrain,
  sampleWorld,
  type CityBiome,
} from "@/game/simulation/terrain";

describe("deterministic terrain", () => {
  it("is stable across calls for same seed and coords", () => {
    const a = generateTerrain(1, 10n, -5n);
    const b = generateTerrain(1, 10n, -5n);
    expect(a).toBe(b);
    expect(sampleWorld(1, 10n, -5n)).toEqual(sampleWorld(1, 10n, -5n));
  });

  it("sampleWorld kind matches generateTerrain", () => {
    for (const [x, y] of [
      [0n, 0n],
      [10n, -5n],
      [100n, 100n],
      [-40n, 22n],
    ] as const) {
      expect(sampleWorld(42, x, y).kind).toBe(generateTerrain(42, x, y));
    }
  });

  it("keeps the starter neighborhood mostly buildable", () => {
    let buildable = 0;
    let total = 0;
    for (let x = -8; x <= 10; x++) {
      for (let y = -4; y <= 8; y++) {
        total++;
        const kind = generateTerrain(1, BigInt(x), BigInt(y));
        if (isBuildableTerrain(kind) || kind === "tree" || kind === "stone_pile") {
          buildable++;
        }
      }
    }
    expect(buildable / total).toBeGreaterThan(0.85);
  });

  it("starter sits on a plateau rather than a crater floor", () => {
    const origin = sampleWorld(1, 0n, 0n).height;
    let samples = 0;
    let ringSum = 0;
    let walls = 0;
    for (let x = -40; x <= 40; x += 4) {
      for (let y = -40; y <= 40; y += 4) {
        const d2 = x * x + y * y;
        if (d2 < 900 || d2 > 2200) continue; // just outside starter ring
        samples++;
        const h = sampleWorld(1, BigInt(x), BigInt(y)).height;
        ringSum += h;
        if (h > origin + 2) walls++;
      }
    }
    expect(origin).toBeGreaterThanOrEqual(3);
    // Approach may roll a little, but must not form crater walls
    expect(ringSum / samples).toBeLessThanOrEqual(origin + 1.25);
    expect(walls / samples).toBeLessThan(0.2);
  });

  it("favors meadow/plains near origin", () => {
    const counts = new Map<CityBiome, number>();
    for (let x = -12; x <= 12; x++) {
      for (let y = -12; y <= 12; y++) {
        const b = sampleWorld(3, BigInt(x), BigInt(y)).biome;
        counts.set(b, (counts.get(b) ?? 0) + 1);
      }
    }
    const soft =
      (counts.get("meadow") ?? 0) +
      (counts.get("plains") ?? 0) +
      (counts.get("forest") ?? 0);
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    expect(soft / total).toBeGreaterThan(0.55);
  });

  it("meadows do not spawn stone piles; mountains do not spawn trees", () => {
    let meadowStone = 0;
    let meadowSamples = 0;
    let mountainTree = 0;
    let mountainSamples = 0;
    let nearTownStone = 0;
    for (let x = -150; x <= 150; x += 3) {
      for (let y = -150; y <= 150; y += 3) {
        const s = sampleWorld(19, BigInt(x), BigInt(y));
        if (s.biome === "meadow") {
          meadowSamples++;
          if (s.kind === "stone_pile") meadowStone++;
        }
        if (s.biome === "mountain" || s.biome === "alpine" || s.biome === "snow") {
          mountainSamples++;
          if (s.kind === "tree") mountainTree++;
        }
        if (x * x + y * y <= 28 * 28 && s.kind === "stone_pile") nearTownStone++;
      }
    }
    expect(meadowSamples).toBeGreaterThan(20);
    expect(meadowStone).toBe(0);
    expect(nearTownStone).toBe(0);
    if (mountainSamples > 0) expect(mountainTree).toBe(0);
  });

  it("produces water somewhere in a wide sample", () => {
    let found = false;
    outer: for (let x = -120; x <= 120; x += 3) {
      for (let y = -120; y <= 120; y += 3) {
        if (generateTerrain(7, BigInt(x), BigInt(y)) === "water") {
          found = true;
          break outer;
        }
      }
    }
    expect(found).toBe(true);
  });

  it("height stays in range", () => {
    for (let i = 0; i < 80; i++) {
      const s = sampleWorld(99, BigInt(i * 7 - 80), BigInt(i * 5 - 60));
      expect(s.height).toBeGreaterThanOrEqual(0);
      expect(s.height).toBeLessThanOrEqual(12);
    }
  });

  it("avoids lone height spikes (smoothed field)", () => {
    let spikes = 0;
    let samples = 0;
    for (let x = -80; x <= 80; x += 2) {
      for (let y = -80; y <= 80; y += 2) {
        if (x * x + y * y < 40 * 40) continue; // skip town flattening
        const h = sampleWorld(11, BigInt(x), BigInt(y)).height;
        const n = [
          sampleWorld(11, BigInt(x + 1), BigInt(y)).height,
          sampleWorld(11, BigInt(x - 1), BigInt(y)).height,
          sampleWorld(11, BigInt(x), BigInt(y + 1)).height,
          sampleWorld(11, BigInt(x), BigInt(y - 1)).height,
        ];
        samples++;
        // A spike: this tile ≥2 above every orthogonal neighbor
        if (n.every((nh) => h >= nh + 2)) spikes++;
      }
    }
    expect(samples).toBeGreaterThan(100);
    expect(spikes / samples).toBeLessThan(0.02);
  });

  it("produces both high peaks and low valleys away from town", () => {
    let maxH = 0;
    let minH = 12;
    for (let x = -200; x <= 200; x += 5) {
      for (let y = -200; y <= 200; y += 5) {
        if (x * x + y * y < 50 * 50) continue;
        const h = sampleWorld(5, BigInt(x), BigInt(y)).height;
        maxH = Math.max(maxH, h);
        minH = Math.min(minH, h);
      }
    }
    expect(maxH).toBeGreaterThanOrEqual(8);
    expect(minH).toBeLessThanOrEqual(2);
  });
});
