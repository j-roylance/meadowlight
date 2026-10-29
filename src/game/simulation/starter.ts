import { STARTING_RESOURCES } from "@/game/catalog/definitions";
import {
  ZERO_RESOURCES,
  emptyExpansion,
  type CityState,
  type PlacedEntity,
  type RoadTile,
  type Specialty,
} from "@/game/types";
import { computeBuildingRates, applyRates } from "./economy";

function eid(prefix: string, n: number): string {
  return `${prefix}-${n}`;
}

/** Authored starter neighborhood near the origin. */
export function createStarterCity(opts: {
  id: string;
  ownerId: string;
  name: string;
  displayName: string;
  specialty: Specialty;
  now: number;
  seed?: number;
}): CityState {
  const seed = opts.seed ?? Math.floor(Math.random() * 1_000_000_000);

  // Town hall is 3×3 at (0,0) → occupies tiles x=0..2, y=0..2.
  const entities: PlacedEntity[] = [
    {
      id: eid("th", 1),
      definitionId: "town_hall",
      level: 1,
      x: 0n,
      y: 0n,
      rotation: 0,
      stored: false,
      revision: 1,
    },
    {
      id: eid("cot", 1),
      definitionId: "cottage_a",
      level: 1,
      x: 4n,
      y: 1n,
      rotation: 0,
      stored: false,
      revision: 1,
    },
    {
      id: eid("cot", 2),
      definitionId: "cottage_b",
      level: 1,
      x: 5n,
      y: 1n,
      rotation: 0,
      stored: false,
      revision: 1,
    },
    {
      id: eid("tw", 1),
      definitionId: "wood_workshop",
      level: 1,
      x: -2n,
      y: 1n,
      rotation: 0,
      stored: false,
      revision: 1,
    },
    {
      id: eid("sy", 1),
      definitionId: "stone_yard",
      level: 1,
      x: -2n,
      y: 2n,
      rotation: 0,
      stored: false,
      revision: 1,
    },
    {
      id: eid("pp", 1),
      definitionId: "pocket_park",
      level: 1,
      x: 4n,
      y: 4n,
      rotation: 0,
      stored: false,
      revision: 1,
    },
    {
      id: eid("proj", 1),
      definitionId: "project_site",
      level: 1,
      x: 7n,
      y: 4n,
      rotation: 0,
      stored: false,
      appearance: { projectType: "riverside_park" },
      revision: 1,
    },
  ];

  // Roads south and east of the 3×3 hall (no overlap with buildings).
  const roads: RoadTile[] = [];
  for (let i = -1; i <= 6; i++) {
    roads.push({ x: BigInt(i), y: 3n, style: "dirt" });
  }
  for (let j = 0; j <= 2; j++) {
    roads.push({ x: 3n, y: BigInt(j), style: "dirt" });
  }

  const city: CityState = {
    id: opts.id,
    ownerId: opts.ownerId,
    name: opts.name,
    displayName: opts.displayName,
    specialty: opts.specialty,
    seed,
    generatorVersion: 1,
    createdAt: opts.now,
    revision: 1,
    arrivalX: 1n,
    arrivalY: -1n,
    economy: {
      ...STARTING_RESOURCES,
      remCoins: 0,
      remWood: 0,
      remStone: 0,
      remResearch: 0,
      remHappiness: 0,
      rateCoins: 0,
      rateWood: 0,
      rateStone: 0,
      rateResearch: 0,
      rateHappiness: 0,
      lastSettledAt: opts.now,
      actionsRemaining: 2,
      actionWindowStartAt: opts.now,
    },
    entities,
    roads,
    portals: [],
    projects: [
      {
        id: eid("hp", 1),
        definitionId: "riverside_park",
        entityId: eid("proj", 1),
        workCurrent: 0,
        status: "untouched",
        contributors: [],
      },
    ],
    blueprints: [],
    friendships: [],
    circle: null,
    delivery: { inboundEnabled: true, blockedSourceCityIds: [] },
    activity: [
      {
        id: "welcome",
        at: opts.now,
        kind: "welcome",
        message: "Welcome to your meadow. Two actions per twelve-hour window. Unused actions do not carry over.",
      },
    ],
    returnSummary: null,
    onboardingComplete: false,
    terrainOverrides: {},
    expansion: emptyExpansion(),
  };

  const rates = computeBuildingRates(city);
  city.economy = applyRates(city.economy, rates, { ...ZERO_RESOURCES });
  return city;
}
