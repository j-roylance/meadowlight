import { BUILDINGS, PROJECTS } from "@/game/catalog/definitions";
import {
  WINDOW_MS,
  ZERO_RESOURCES,
  type CityState,
  type EconomyState,
  type PlacedEntity,
  type ProjectDefId,
  type Resources,
  type Specialty,
  type YieldRates,
} from "@/game/types";
import { settleActionWindow } from "./actions";
import { settleGardens, upcomingMaturityTimes } from "./garden";

export function settleProduction(
  economy: EconomyState,
  now: number
): { economy: EconomyState; earned: Resources } {
  const effective = Math.max(now, economy.lastSettledAt);
  const elapsed = effective - economy.lastSettledAt;
  if (elapsed <= 0) {
    return {
      economy: { ...economy, lastSettledAt: effective },
      earned: { ...ZERO_RESOURCES },
    };
  }

  const settleOne = (rate: number, rem: number, balance: number) => {
    const numerator = rate * elapsed + rem;
    const earned = Math.floor(numerator / WINDOW_MS);
    const remainder = numerator % WINDOW_MS;
    return { balance: balance + earned, remainder, earned };
  };

  const c = settleOne(economy.rateCoins, economy.remCoins, economy.coins);
  const t = settleOne(economy.rateWood, economy.remWood, economy.wood);
  const s = settleOne(economy.rateStone, economy.remStone, economy.stone);
  const r = settleOne(economy.rateResearch, economy.remResearch, economy.research);
  const h = settleOne(economy.rateHappiness, economy.remHappiness, economy.happiness);

  return {
    economy: {
      ...economy,
      coins: c.balance,
      wood: t.balance,
      stone: s.balance,
      research: r.balance,
      happiness: h.balance,
      remCoins: c.remainder,
      remWood: t.remainder,
      remStone: s.remainder,
      remResearch: r.remainder,
      remHappiness: h.remainder,
      lastSettledAt: effective,
    },
    earned: {
      coins: c.earned,
      wood: t.earned,
      stone: s.earned,
      research: r.earned,
      happiness: h.earned,
    },
  };
}

export function settleCity(city: CityState, now: number): {
  city: CityState;
  earned: Resources;
} {
  let working = city;
  let economy = settleActionWindow(working.economy, now);
  const from = economy.lastSettledAt;
  const boundaries = working.expansion
    ? upcomingMaturityTimes(working, from, now)
    : [];
  // Preserve commerce as (current rates − building rates) across garden boundaries.
  const building0 = computeBuildingRates(working);
  const commerce: Resources = {
    coins: economy.rateCoins - building0.coins,
    wood: economy.rateWood - building0.wood,
    stone: economy.rateStone - building0.stone,
    research: economy.rateResearch - building0.research,
    happiness: economy.rateHappiness - building0.happiness,
  };

  let earned: Resources = { ...ZERO_RESOURCES };
  let cursor = from;
  for (const t of [...boundaries, now]) {
    if (t <= cursor) continue;
    economy = { ...economy, lastSettledAt: cursor };
    const prod = settleProduction(economy, t);
    economy = prod.economy;
    earned = {
      coins: earned.coins + prod.earned.coins,
      wood: earned.wood + prod.earned.wood,
      stone: earned.stone + prod.earned.stone,
      research: earned.research + prod.earned.research,
      happiness: earned.happiness + prod.earned.happiness,
    };
    working = settleGardens({ ...working, economy }, t);
    economy = working.economy;
    const building = computeBuildingRates(working);
    economy = applyRates(economy, building, commerce);
    working = { ...working, economy };
    cursor = t;
  }
  return { city: { ...working, economy }, earned };
}

/** Yield for a placed entity, including finished project sites. */
export function yieldForEntity(e: PlacedEntity): YieldRates | null {
  if (e.stored) return null;
  if (e.definitionId === "project_site") {
    if (e.appearance?.stage === "complete" && e.appearance.projectType) {
      const project = PROJECTS[e.appearance.projectType as ProjectDefId];
      if (!project) return null;
      const landmark = BUILDINGS[project.landmarkBlueprint];
      return landmark?.level1.yield ?? null;
    }
    return null;
  }
  const def = BUILDINGS[e.definitionId];
  if (!def) return null;
  const stats = e.level === 2 && def.level2 ? def.level2 : def.level1;
  return stats.yield;
}

export function computeBuildingRates(city: CityState): Resources {
  const rates: Resources = { ...ZERO_RESOURCES };
  for (const e of city.entities) {
    const y = yieldForEntity(e);
    if (!y) continue;
    rates.coins += y.coins;
    rates.wood += y.wood;
    rates.stone += y.stone;
    rates.research += y.research;
    rates.happiness += y.happiness;
  }
  // Placed backyard mature-flower beds (never count stored beds).
  rates.happiness += city.expansion?.backyardHappinessRate ?? 0;
  return rates;
}

export function commerceYieldForSpecialty(specialty: Specialty): Resources {
  if (specialty === "markets") return { ...ZERO_RESOURCES, coins: 3 };
  if (specialty === "wood") return { ...ZERO_RESOURCES, wood: 3 };
  return { ...ZERO_RESOURCES, stone: 3 };
}

export function applyRates(
  economy: EconomyState,
  building: Resources,
  commerce: Resources
): EconomyState {
  return {
    ...economy,
    rateCoins: building.coins + commerce.coins,
    rateWood: building.wood + commerce.wood,
    rateStone: building.stone + commerce.stone,
    rateResearch: building.research + commerce.research,
    rateHappiness: building.happiness + commerce.happiness,
  };
}

export function canAfford(economy: EconomyState, cost: Resources): boolean {
  return (
    economy.coins >= cost.coins &&
    economy.wood >= cost.wood &&
    economy.stone >= cost.stone &&
    economy.research >= cost.research &&
    economy.happiness >= cost.happiness
  );
}

export function deduct(economy: EconomyState, cost: Resources): EconomyState {
  if (!canAfford(economy, cost)) throw new Error("Cannot afford");
  return {
    ...economy,
    coins: economy.coins - cost.coins,
    wood: economy.wood - cost.wood,
    stone: economy.stone - cost.stone,
    research: economy.research - cost.research,
    happiness: economy.happiness - cost.happiness,
  };
}

export function credit(economy: EconomyState, amount: Resources): EconomyState {
  return {
    ...economy,
    coins: economy.coins + amount.coins,
    wood: economy.wood + amount.wood,
    stone: economy.stone + amount.stone,
    research: economy.research + amount.research,
    happiness: economy.happiness + amount.happiness,
  };
}

export function populationAndAmenity(city: CityState): {
  population: number;
  amenity: number;
} {
  let population = 0;
  let amenity = 0;
  for (const e of city.entities) {
    if (e.stored) continue;
    if (e.definitionId === "project_site" && e.appearance?.stage === "complete" && e.appearance.projectType) {
      const project = PROJECTS[e.appearance.projectType as ProjectDefId];
      const landmark = project ? BUILDINGS[project.landmarkBlueprint] : null;
      if (landmark) {
        population += landmark.level1.residents;
        amenity += landmark.level1.amenity;
      }
      continue;
    }
    const def = BUILDINGS[e.definitionId];
    if (!def) continue;
    const stats = e.level === 2 && def.level2 ? def.level2 : def.level1;
    population += stats.residents;
    amenity += stats.amenity;
  }
  return { population, amenity };
}
