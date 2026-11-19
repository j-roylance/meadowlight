import { describe, expect, it } from "vitest";
import { tryHarvest } from "@/game/simulation/harvest";
import { createStarterCity } from "@/game/simulation/starter";
import { generateTerrain, resolveTerrain } from "@/game/simulation/terrain";
import { HARVEST_STONE, HARVEST_WOOD } from "@/game/types";

describe("harvest", () => {
  it("grants wood for a tree and clears the tile", () => {
    const city = createStarterCity({
      id: "t",
      ownerId: "o",
      name: "T",
      displayName: "T",
      specialty: "markets",
      now: 0,
      seed: 1,
    });
    // Find a tree tile away from starter footprint (biome-gated scatter)
    let tx = 20n;
    let ty = 20n;
    let found = false;
    outer: for (let x = 30; x < 160; x += 2) {
      for (let y = 30; y < 160; y += 2) {
        if (generateTerrain(1, BigInt(x), BigInt(y)) === "tree") {
          tx = BigInt(x);
          ty = BigInt(y);
          found = true;
          break outer;
        }
      }
    }
    expect(found).toBe(true);
    expect(resolveTerrain(city, tx, ty)).toBe("tree");
    const beforeWood = city.economy.wood;
    const beforeActions = city.economy.actionsRemaining;
    const result = tryHarvest(city, tx, ty, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.city.economy.wood).toBe(beforeWood + HARVEST_WOOD);
    expect(result.city.economy.actionsRemaining).toBe(beforeActions - 1);
    expect(resolveTerrain(result.city, tx, ty)).toBe("grass");
  });

  it("grants stone for a stone pile", () => {
    const city = createStarterCity({
      id: "t",
      ownerId: "o",
      name: "T",
      displayName: "T",
      specialty: "markets",
      now: 0,
      seed: 1,
    });
    let tx = 20n;
    let ty = 21n;
    let found = false;
    outer: for (let x = 40; x < 200; x += 2) {
      for (let y = -80; y < 80; y += 2) {
        if (generateTerrain(1, BigInt(x), BigInt(y)) === "stone_pile") {
          tx = BigInt(x);
          ty = BigInt(y);
          found = true;
          break outer;
        }
      }
    }
    expect(found).toBe(true);
    expect(resolveTerrain(city, tx, ty)).toBe("stone_pile");
    const before = city.economy.stone;
    const result = tryHarvest(city, tx, ty, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.city.economy.stone).toBe(before + HARVEST_STONE);
  });
});
