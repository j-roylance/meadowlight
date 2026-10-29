import { describe, expect, it } from "vitest";
import { createStarterCity } from "@/game/simulation/starter";
import {
  MAX_WALKERS,
  buildWalkerRoutes,
  countWalkerBuildings,
  walkerCount,
} from "@/game/rendering/walkers";

describe("town walkers", () => {
  it("scales with buildings × happiness and caps", () => {
    const city = createStarterCity({
      id: "c1",
      ownerId: "u1",
      name: "t",
      displayName: "T",
      specialty: "markets",
      now: 1,
      seed: 1,
    });
    const buildings = countWalkerBuildings(city);
    expect(buildings).toBeGreaterThanOrEqual(2);

    city.economy.happiness = 0;
    expect(walkerCount(city)).toBe(0);

    city.economy.happiness = 1;
    expect(walkerCount(city)).toBe(
      Math.min(MAX_WALKERS, Math.floor(Math.sqrt(buildings * 1)))
    );

    city.economy.happiness = 10_000;
    expect(walkerCount(city)).toBe(MAX_WALKERS);
  });

  it("builds at most MAX_WALKERS routes", () => {
    const city = createStarterCity({
      id: "c1",
      ownerId: "u1",
      name: "t",
      displayName: "T",
      specialty: "markets",
      now: 1,
      seed: 1,
    });
    city.economy.happiness = 999;
    const n = walkerCount(city);
    const routes = buildWalkerRoutes(city, 0, n);
    expect(routes.length).toBe(n);
    expect(routes.length).toBeLessThanOrEqual(MAX_WALKERS);
  });
});
