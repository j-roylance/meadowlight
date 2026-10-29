import type {
  BuildingDefinition,
  ProjectDefinition,
  Resources,
} from "@/game/types";

export const STARTING_RESOURCES: Resources = {
  coins: 80,
  wood: 60,
  stone: 40,
  research: 0,
  happiness: 6,
};

export const BUILDINGS: Record<string, BuildingDefinition> = {
  town_hall: {
    id: "town_hall",
    name: "Town Hall",
    category: "town",
    footprint: { w: 3, h: 3 },
    cost: { coins: 0, wood: 0, stone: 0, research: 0, happiness: 0 },
    level1: {
      yield: { coins: 18, wood: 8, stone: 8, research: 0, happiness: 0 },
      residents: 0,
      amenity: 0,
    },
    upgradeable: false,
  },
  cottage_a: {
    id: "cottage_a",
    name: "Cottage (Thatch)",
    category: "house",
    footprint: { w: 1, h: 1 },
    cost: { coins: 12, wood: 8, stone: 4, research: 0, happiness: 0 },
    level1: { yield: { coins: 4, wood: 0, stone: 0, research: 0, happiness: 0 }, residents: 4, amenity: 0 },
    level2: { yield: { coins: 6, wood: 0, stone: 0, research: 0, happiness: 0 }, residents: 8, amenity: 0 },
    upgradeable: true,
    stylable: true,
    styleGroup: "cottage",
  },
  cottage_b: {
    id: "cottage_b",
    name: "Cottage (Clay)",
    category: "house",
    footprint: { w: 1, h: 1 },
    cost: { coins: 12, wood: 8, stone: 4, research: 0, happiness: 0 },
    level1: { yield: { coins: 4, wood: 0, stone: 0, research: 0, happiness: 0 }, residents: 4, amenity: 0 },
    level2: { yield: { coins: 6, wood: 0, stone: 0, research: 0, happiness: 0 }, residents: 8, amenity: 0 },
    upgradeable: true,
    stylable: true,
    styleGroup: "cottage",
  },
  cottage_c: {
    id: "cottage_c",
    name: "Cottage (Moss)",
    category: "house",
    footprint: { w: 1, h: 1 },
    cost: { coins: 12, wood: 8, stone: 4, research: 0, happiness: 0 },
    level1: { yield: { coins: 4, wood: 0, stone: 0, research: 0, happiness: 0 }, residents: 4, amenity: 0 },
    level2: { yield: { coins: 6, wood: 0, stone: 0, research: 0, happiness: 0 }, residents: 8, amenity: 0 },
    upgradeable: true,
    stylable: true,
    styleGroup: "cottage",
  },
  wood_workshop: {
    id: "wood_workshop",
    name: "Wood Workshop",
    category: "town",
    footprint: { w: 1, h: 1 },
    cost: { coins: 10, wood: 14, stone: 4, research: 0, happiness: 0 },
    level1: { yield: { coins: 0, wood: 6, stone: 0, research: 0, happiness: 0 }, residents: 0, amenity: 0 },
    level2: { yield: { coins: 0, wood: 10, stone: 0, research: 0, happiness: 0 }, residents: 0, amenity: 0 },
    upgradeable: true,
  },
  stone_yard: {
    id: "stone_yard",
    name: "Stone Yard",
    category: "town",
    footprint: { w: 1, h: 1 },
    cost: { coins: 10, wood: 8, stone: 12, research: 0, happiness: 0 },
    level1: { yield: { coins: 0, wood: 0, stone: 6, research: 0, happiness: 0 }, residents: 0, amenity: 0 },
    level2: { yield: { coins: 0, wood: 0, stone: 10, research: 0, happiness: 0 }, residents: 0, amenity: 0 },
    upgradeable: true,
  },
  neighborhood_market: {
    id: "neighborhood_market",
    name: "Neighborhood Market",
    category: "town",
    footprint: { w: 1, h: 1 },
    cost: { coins: 22, wood: 16, stone: 12, research: 0, happiness: 0 },
    level1: { yield: { coins: 10, wood: 0, stone: 0, research: 0, happiness: 0 }, residents: 0, amenity: 0 },
    level2: { yield: { coins: 16, wood: 0, stone: 0, research: 0, happiness: 0 }, residents: 0, amenity: 0 },
    upgradeable: true,
  },
  flower_garden: {
    id: "flower_garden",
    name: "Flower Garden",
    category: "town",
    footprint: { w: 1, h: 1 },
    cost: { coins: 10, wood: 6, stone: 4, research: 0, happiness: 0 },
    level1: { yield: { coins: 0, wood: 0, stone: 0, research: 0, happiness: 1 }, residents: 0, amenity: 2 },
    level2: { yield: { coins: 0, wood: 0, stone: 0, research: 0, happiness: 2 }, residents: 0, amenity: 4 },
    upgradeable: true,
  },
  pocket_park: {
    id: "pocket_park",
    name: "Pocket Park",
    category: "town",
    footprint: { w: 2, h: 2 },
    cost: { coins: 16, wood: 10, stone: 8, research: 0, happiness: 0 },
    level1: { yield: { coins: 0, wood: 0, stone: 0, research: 0, happiness: 3 }, residents: 0, amenity: 4 },
    level2: { yield: { coins: 0, wood: 0, stone: 0, research: 0, happiness: 5 }, residents: 0, amenity: 8 },
    upgradeable: true,
  },
  portal: {
    id: "portal",
    name: "Portal",
    category: "portal",
    footprint: { w: 1, h: 1 },
    cost: { coins: 0, wood: 0, stone: 0, research: 0, happiness: 0 },
    level1: { yield: { coins: 0, wood: 0, stone: 0, research: 0, happiness: 0 }, residents: 0, amenity: 0 },
    upgradeable: false,
  },
  project_site: {
    id: "project_site",
    name: "Project Site",
    category: "project",
    footprint: { w: 4, h: 4 },
    cost: { coins: 0, wood: 0, stone: 0, research: 0, happiness: 0 },
    level1: { yield: { coins: 0, wood: 0, stone: 0, research: 0, happiness: 0 }, residents: 0, amenity: 0 },
    upgradeable: false,
  },
  landmark_park: {
    id: "landmark_park",
    name: "Park",
    category: "cosmetic",
    footprint: { w: 2, h: 2 },
    cost: { coins: 0, wood: 0, stone: 0, research: 0, happiness: 0 },
    level1: {
      yield: { coins: 0, wood: 0, stone: 0, research: 0, happiness: 8 },
      residents: 0,
      amenity: 6,
    },
    upgradeable: false,
  },
  landmark_museum: {
    id: "landmark_museum",
    name: "Community Museum",
    category: "cosmetic",
    footprint: { w: 2, h: 2 },
    cost: { coins: 0, wood: 0, stone: 0, research: 0, happiness: 0 },
    level1: {
      yield: { coins: 0, wood: 0, stone: 0, research: 3, happiness: 0 },
      residents: 0,
      amenity: 2,
    },
    upgradeable: false,
  },
  landmark_rec: {
    id: "landmark_rec",
    name: "Municipal Recreation Center",
    category: "cosmetic",
    footprint: { w: 2, h: 2 },
    cost: { coins: 0, wood: 0, stone: 0, research: 0, happiness: 0 },
    level1: {
      yield: { coins: 0, wood: 0, stone: 0, research: 0, happiness: 4 },
      residents: 0,
      amenity: 4,
    },
    upgradeable: false,
  },
  landmark_tower: {
    id: "landmark_tower",
    name: "Skyscraper",
    category: "cosmetic",
    footprint: { w: 2, h: 2 },
    cost: { coins: 0, wood: 0, stone: 0, research: 0, happiness: 0 },
    level1: {
      yield: { coins: 4, wood: 0, stone: 0, research: 0, happiness: 2 },
      residents: 0,
      amenity: 2,
    },
    upgradeable: false,
  },
  landmark_university: {
    id: "landmark_university",
    name: "University",
    category: "cosmetic",
    footprint: { w: 2, h: 2 },
    cost: { coins: 0, wood: 0, stone: 0, research: 0, happiness: 0 },
    level1: {
      yield: { coins: 0, wood: 0, stone: 0, research: 6, happiness: 0 },
      residents: 0,
      amenity: 2,
    },
    upgradeable: false,
  },
  landmark_bank: {
    id: "landmark_bank",
    name: "Bank",
    category: "cosmetic",
    footprint: { w: 2, h: 2 },
    cost: { coins: 0, wood: 0, stone: 0, research: 0, happiness: 0 },
    level1: {
      yield: { coins: 2, wood: 0, stone: 0, research: 0, happiness: 0 },
      residents: 0,
      amenity: 0,
    },
    upgradeable: false,
  },
  /** Decorative replica from Space Center completion — not an operational pad. */
  landmark_space_center: {
    id: "landmark_space_center",
    name: "Space Center Replica",
    category: "cosmetic",
    footprint: { w: 4, h: 4 },
    cost: { coins: 0, wood: 0, stone: 0, research: 0, happiness: 0 },
    level1: {
      yield: { coins: 0, wood: 0, stone: 0, research: 0, happiness: 0 },
      residents: 0,
      amenity: 0,
    },
    upgradeable: false,
  },
  /** Legacy direct-build id — kept for save migration; prefer the hosted project. */
  space_center: {
    id: "space_center",
    name: "Space Center",
    category: "town",
    footprint: { w: 4, h: 4 },
    cost: { coins: 80, wood: 40, stone: 40, research: 10, happiness: 0 },
    level1: { yield: { coins: 0, wood: 0, stone: 0, research: 0, happiness: 0 }, residents: 0, amenity: 0 },
    upgradeable: false,
  },
};

export const PROJECTS: Record<string, ProjectDefinition> = {
  riverside_park: {
    id: "riverside_park",
    name: "Park",
    workRequired: 24,
    startCoins: 70,
    startResearch: 0,
    workCost: { wood: 8, stone: 8, research: 0 },
    landmarkBlueprint: "landmark_park",
    description: "When finished, adds a lot of happiness every 12 hours.",
  },
  municipal_rec: {
    id: "municipal_rec",
    name: "Municipal Recreation Center",
    workRequired: 12,
    startCoins: 30,
    startResearch: 6,
    workCost: { wood: 5, stone: 5, research: 1 },
    landmarkBlueprint: "landmark_rec",
    description: "When finished, adds some happiness every 12 hours. Costs research to build.",
  },
  community_museum: {
    id: "community_museum",
    name: "Community Museum",
    workRequired: 8,
    startCoins: 25,
    startResearch: 0,
    workCost: { wood: 4, stone: 4, research: 0 },
    landmarkBlueprint: "landmark_museum",
    description: "When finished, produces a little research every 12 hours.",
  },
  community_university: {
    id: "community_university",
    name: "University",
    workRequired: 22,
    startCoins: 55,
    startResearch: 20,
    workCost: { wood: 7, stone: 7, research: 4 },
    landmarkBlueprint: "landmark_university",
    description: "When finished, produces strong research every 12 hours. Heavy research cost to build.",
  },
  town_bank: {
    id: "town_bank",
    name: "Bank",
    workRequired: 14,
    startCoins: 40,
    startResearch: 8,
    workCost: { wood: 5, stone: 6, research: 2 },
    landmarkBlueprint: "landmark_bank",
    description: "When finished, click it to exchange resources. Each bank increases exchange size.",
  },
  skyline_tower: {
    id: "skyline_tower",
    name: "Skyscraper",
    workRequired: 40,
    startCoins: 100,
    startResearch: 0,
    workCost: { wood: 5, stone: 5, research: 0 },
    landmarkBlueprint: "landmark_tower",
    description: "Landmark skyline piece — small coins and happiness when finished.",
  },
  space_center: {
    id: "space_center",
    name: "Space Center",
    workRequired: 8,
    startCoins: 80,
    startResearch: 10,
    workCost: { wood: 5, stone: 5, research: 0 },
    landmarkBlueprint: "landmark_space_center",
    description:
      "Mission control and rocket pad. When finished, launch your orbital station. Costs research to start; wood and stone to finish.",
  },
};

/** Short blurbs for town / house buildings (tooltips). */
export const BUILDING_TIPS: Partial<Record<string, string>> = {
  cottage_a: "Houses residents and earns coins every 12 hours.",
  cottage_b: "Houses residents and earns coins every 12 hours.",
  cottage_c: "Houses residents and earns coins every 12 hours.",
  wood_workshop: "Passively produces wood every 12 hours.",
  stone_yard: "Passively produces stone every 12 hours.",
  neighborhood_market: "Passively produces coins every 12 hours.",
  flower_garden: "Adds a little happiness and amenity.",
  pocket_park: "Adds happiness and amenity every 12 hours.",
  town_hall: "Your town center — steady coins, wood, and stone.",
  landmark_park: "Finished park — high happiness every 12 hours.",
  landmark_rec: "Finished rec center — some happiness every 12 hours.",
  landmark_museum: "Finished museum — modest research every 12 hours.",
  landmark_university: "Finished university — strong research every 12 hours.",
  landmark_bank: "Click to exchange resources. More banks = bigger exchanges.",
  landmark_tower: "Finished skyscraper — a little coins and happiness.",
  portal: "Click to send resources or project work to another city.",
  project_site: "Contribute materials to advance this shared project.",
  space_center: "Hosted Space Center — finish it, then launch your orbital station.",
  landmark_space_center: "Decorative Space Center replica — not an operational launch pad.",
};

export const HOUSE_STYLES = ["cottage_a", "cottage_b", "cottage_c"] as const;

export function getBuilding(id: string): BuildingDefinition {
  const def = BUILDINGS[id];
  if (!def) throw new Error(`Unknown building: ${id}`);
  return def;
}

/** Soft lookup — unknown saved project types must not crash the client. */
export function tryGetProject(id: string): ProjectDefinition | null {
  return PROJECTS[id] ?? null;
}

export function getProject(id: string): ProjectDefinition {
  const def = tryGetProject(id);
  if (!def) {
    throw new Error(
      `Unknown project: ${id} (known: ${Object.keys(PROJECTS).join(", ")})`
    );
  }
  return def;
}

export function upgradeCost(def: BuildingDefinition): Resources {
  return {
    coins: def.cost.coins * 2,
    wood: def.cost.wood * 2,
    stone: def.cost.stone * 2,
    research: def.cost.research * 2,
    happiness: def.cost.happiness * 2,
  };
}
