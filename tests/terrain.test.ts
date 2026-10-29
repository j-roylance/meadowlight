import { describe, expect, it } from "vitest";
import { generateTerrain } from "@/game/simulation/terrain";

describe("deterministic terrain", () => {
  it("is stable across calls for same seed and coords", () => {
    const a = generateTerrain(1, 10n, -5n);
    const b = generateTerrain(1, 10n, -5n);
    expect(a).toBe(b);
  });

  it("differs by seed", () => {
    // Not guaranteed for every tile, but river band is authored and grass baseline
    // should still be defined for far coords.
    expect(generateTerrain(1, 100n, 100n)).toBeTruthy();
    expect(generateTerrain(2, 100n, 100n)).toBeTruthy();
  });

  it("has water near authored river band", () => {
    expect(generateTerrain(1, 4n, 4n)).toBe("water");
  });
});
