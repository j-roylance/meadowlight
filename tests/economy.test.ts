import { describe, expect, it } from "vitest";
import { settleProduction } from "@/game/simulation/economy";
import { createStarterCity } from "@/game/simulation/starter";
import { computeBuildingRates } from "@/game/simulation/economy";
import { WINDOW_MS } from "@/game/types";

describe("offline production", () => {
  it("starting town rates include pocket-park happiness", () => {
    const city = createStarterCity({
      id: "t",
      ownerId: "o",
      name: "T",
      displayName: "T",
      specialty: "markets",
      now: 0,
      seed: 1,
    });
    const rates = computeBuildingRates(city);
    expect(rates).toEqual({
      coins: 26,
      wood: 14,
      stone: 14,
      research: 0,
      happiness: 3,
    });
  });

  it("24 hours accrues production for unchanged starter", () => {
    const city = createStarterCity({
      id: "t",
      ownerId: "o",
      name: "T",
      displayName: "T",
      specialty: "markets",
      now: 0,
      seed: 1,
    });
    const { economy, earned } = settleProduction(city.economy, WINDOW_MS * 2);
    expect(earned).toEqual({
      coins: 52,
      wood: 28,
      stone: 28,
      research: 0,
      happiness: 6,
    });
    expect(economy.coins).toBe(80 + 52);
    expect(economy.wood).toBe(60 + 28);
    expect(economy.stone).toBe(40 + 28);
    expect(economy.research).toBe(0);
    expect(economy.happiness).toBe(6 + 6);
  });

  it("partial settlements equal one long settlement", () => {
    const city = createStarterCity({
      id: "t",
      ownerId: "o",
      name: "T",
      displayName: "T",
      specialty: "markets",
      now: 0,
      seed: 1,
    });
    let e = city.economy;
    const a = settleProduction(e, WINDOW_MS / 2);
    e = a.economy;
    const b = settleProduction(e, WINDOW_MS);
    const once = settleProduction(city.economy, WINDOW_MS);
    expect(b.economy.coins).toBe(once.economy.coins);
    expect(b.economy.wood).toBe(once.economy.wood);
    expect(b.economy.stone).toBe(once.economy.stone);
    expect(b.economy.research).toBe(once.economy.research);
    expect(b.economy.happiness).toBe(once.economy.happiness);
  });

  it("finished university / museum project sites produce research", () => {
    const city = createStarterCity({
      id: "t",
      ownerId: "o",
      name: "T",
      displayName: "T",
      specialty: "markets",
      now: 0,
      seed: 1,
    });
    city.entities.push(
      {
        id: "uni-site",
        definitionId: "project_site",
        level: 1,
        x: 20n,
        y: 20n,
        rotation: 0,
        stored: false,
        appearance: { stage: "complete", projectType: "community_university" },
        revision: 1,
      },
      {
        id: "mus-site",
        definitionId: "project_site",
        level: 1,
        x: 30n,
        y: 20n,
        rotation: 0,
        stored: false,
        appearance: { stage: "complete", projectType: "community_museum" },
        revision: 1,
      }
    );
    const rates = computeBuildingRates(city);
    expect(rates.research).toBe(6 + 3);
  });

  it("finished park yields more happiness than rec", () => {
    const city = createStarterCity({
      id: "t",
      ownerId: "o",
      name: "T",
      displayName: "T",
      specialty: "markets",
      now: 0,
      seed: 1,
    });
    // Remove starter pocket park so rates are clear
    city.entities = city.entities.filter((e) => e.definitionId !== "pocket_park");
    city.entities.push(
      {
        id: "park",
        definitionId: "project_site",
        level: 1,
        x: 20n,
        y: 20n,
        rotation: 0,
        stored: false,
        appearance: { stage: "complete", projectType: "riverside_park" },
        revision: 1,
      },
      {
        id: "rec",
        definitionId: "project_site",
        level: 1,
        x: 30n,
        y: 20n,
        rotation: 0,
        stored: false,
        appearance: { stage: "complete", projectType: "municipal_rec" },
        revision: 1,
      }
    );
    const rates = computeBuildingRates(city);
    expect(rates.happiness).toBe(8 + 4);
  });
});
