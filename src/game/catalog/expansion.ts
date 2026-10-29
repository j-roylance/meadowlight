import { ZERO_RESOURCES, type Resources } from "@/game/types";

/**
 * Expansion balance v1 — derived from current economy:
 * starter happiness / 12h = 3 (pocket_park L1) → H = max(1, floor(3/4)) = 1
 * research supply-run yield = 20 → R = max(1, floor(20/4)) = 5
 */
export const EXPLORATION_HAPPINESS_COST = 1;
export const SPACE_RESEARCH_UNIT = 5;
export const EXPANSION_CATALOG_VERSION = "1.0.1";

export const GRANT_STARTER_HOME_KIT = "starter_home_kit_v1";
export const GRANT_SPACE_FLOWER_SEED = "space_flower_seed_unlock_v1";

export const ROOM_ADD_COST: Resources = {
  ...ZERO_RESOURCES,
  coins: 22,
  wood: 10,
  stone: 8,
};

export const GARDEN_BED_COST: Resources = {
  ...ZERO_RESOURCES,
  coins: 10,
  wood: 6,
  stone: 4,
};

export const PLANT_SLOT_COIN_COST = 2;

/**
 * Space Center is a hosted project (see PROJECTS.space_center).
 * Start: 80 coins + 2R research (1 action). Work: 8× (5 wood + 5 stone).
 * Kept for cost-line display / tests.
 */
export const SPACE_CENTER_COST: Resources = {
  ...ZERO_RESOURCES,
  coins: 80,
  wood: 40,
  stone: 40,
  research: SPACE_RESEARCH_UNIT * 2,
};

export const FOUNDING_LAUNCH_COST: Resources = {
  ...ZERO_RESOURCES,
  coins: 50,
  wood: 16,
  stone: 24,
  research: SPACE_RESEARCH_UNIT,
};

export const INSTRUMENT_BASE_COST: Resources = {
  ...ZERO_RESOURCES,
  coins: 15,
  wood: 4,
  stone: 8,
  research: SPACE_RESEARCH_UNIT,
};

/** Full four-slot mature flower bed matches flower_garden L1 happiness. */
export const BACKYARD_FLOWER_BED_HAPPINESS = 1;

export type FurnitureDefId =
  | "bed"
  | "sofa"
  | "table"
  | "chair"
  | "counter"
  | "refrigerator"
  | "shelf"
  | "desk"
  | "lamp"
  | "rug"
  | "wall_art"
  | "houseplant"
  | "fence"
  | "path_deco"
  | "bench"
  | "planter"
  | "small_tree"
  | "flower_bed_deco"
  | "raised_bed";

export type PlantVarietyId =
  | "daisy"
  | "rose"
  | "lavender"
  | "basil"
  | "lettuce"
  | "tomato"
  | "space_flower";

export type HarvestItemId =
  | "daisy_bloom"
  | "rose_bloom"
  | "lavender_sprig"
  | "basil_bundle"
  | "lettuce_basket"
  | "tomato_basket"
  | "space_bloom";

export type FurnitureBundleId = "living_room_set" | "bedroom_set" | "study_set";

export type StationModuleDefId =
  | "corridor"
  | "habitation"
  | "laboratory"
  | "greenhouse"
  | "observatory"
  | "solar_power";

export type InstrumentDefId = "telescope" | "survey_console" | "plant_growth_chamber";

export type ItemLayer = "floor" | "furniture" | "wall" | "overlay";

export interface FurnitureDefinition {
  id: FurnitureDefId;
  name: string;
  layer: ItemLayer;
  footprint: { w: number; h: number };
  outdoor?: boolean;
  indoor?: boolean;
  blocks?: boolean;
  /** Raised beds carry planting slots. */
  raisedBedSlots?: number;
  portable: boolean;
}

export interface PlantVarietyDefinition {
  id: PlantVarietyId;
  name: string;
  family: "flower" | "herb" | "vegetable";
  maturityMs: number;
  harvestItemId: HarvestItemId;
  harvestName: string;
  /** Happiness contribution when mature in a backyard bed (flowers only). */
  happinessShare: number;
  starter: boolean;
}

export interface FurnitureBundleDefinition {
  id: FurnitureBundleId;
  name: string;
  cost: Resources;
  items: { definitionId: FurnitureDefId; count: number }[];
}

export interface StationModuleDefinition {
  id: StationModuleDefId;
  name: string;
  cost: Resources;
  powerProvided: number;
  ports: ("n" | "e" | "s" | "w")[];
  instrumentSlots: InstrumentDefId[];
  furnishable: boolean;
}

export interface InstrumentDefinition {
  id: InstrumentDefId;
  name: string;
  cost: Resources;
  powerCost: number;
  fitsModules: StationModuleDefId[];
}

export const FURNITURE: Record<FurnitureDefId, FurnitureDefinition> = {
  bed: {
    id: "bed",
    name: "Bed",
    layer: "furniture",
    footprint: { w: 2, h: 1 },
    indoor: true,
    blocks: true,
    portable: true,
  },
  sofa: {
    id: "sofa",
    name: "Sofa",
    layer: "furniture",
    footprint: { w: 2, h: 1 },
    indoor: true,
    blocks: true,
    portable: true,
  },
  table: {
    id: "table",
    name: "Table",
    layer: "furniture",
    footprint: { w: 1, h: 1 },
    indoor: true,
    blocks: true,
    portable: true,
  },
  chair: {
    id: "chair",
    name: "Chair",
    layer: "furniture",
    footprint: { w: 1, h: 1 },
    indoor: true,
    blocks: true,
    portable: true,
  },
  counter: {
    id: "counter",
    name: "Counter",
    layer: "furniture",
    footprint: { w: 2, h: 1 },
    indoor: true,
    blocks: true,
    portable: true,
  },
  refrigerator: {
    id: "refrigerator",
    name: "Refrigerator",
    layer: "furniture",
    footprint: { w: 1, h: 1 },
    indoor: true,
    blocks: true,
    portable: true,
  },
  shelf: {
    id: "shelf",
    name: "Shelf",
    layer: "furniture",
    footprint: { w: 1, h: 1 },
    indoor: true,
    blocks: true,
    portable: true,
  },
  desk: {
    id: "desk",
    name: "Desk",
    layer: "furniture",
    footprint: { w: 2, h: 1 },
    indoor: true,
    blocks: true,
    portable: true,
  },
  lamp: {
    id: "lamp",
    name: "Lamp",
    layer: "overlay",
    footprint: { w: 1, h: 1 },
    indoor: true,
    blocks: false,
    portable: true,
  },
  rug: {
    id: "rug",
    name: "Rug",
    layer: "floor",
    footprint: { w: 2, h: 2 },
    indoor: true,
    blocks: false,
    portable: true,
  },
  wall_art: {
    id: "wall_art",
    name: "Wall Art",
    layer: "wall",
    footprint: { w: 1, h: 1 },
    indoor: true,
    blocks: false,
    portable: true,
  },
  houseplant: {
    id: "houseplant",
    name: "Houseplant",
    layer: "overlay",
    footprint: { w: 1, h: 1 },
    indoor: true,
    outdoor: true,
    blocks: false,
    portable: true,
  },
  fence: {
    id: "fence",
    name: "Fence",
    layer: "furniture",
    footprint: { w: 1, h: 1 },
    outdoor: true,
    blocks: true,
    portable: true,
  },
  path_deco: {
    id: "path_deco",
    name: "Garden Path",
    layer: "floor",
    footprint: { w: 1, h: 1 },
    outdoor: true,
    blocks: false,
    portable: true,
  },
  bench: {
    id: "bench",
    name: "Bench",
    layer: "furniture",
    footprint: { w: 2, h: 1 },
    outdoor: true,
    blocks: true,
    portable: true,
  },
  planter: {
    id: "planter",
    name: "Planter",
    layer: "furniture",
    footprint: { w: 1, h: 1 },
    outdoor: true,
    blocks: true,
    portable: true,
  },
  small_tree: {
    id: "small_tree",
    name: "Small Tree",
    layer: "furniture",
    footprint: { w: 1, h: 1 },
    outdoor: true,
    blocks: true,
    portable: true,
  },
  flower_bed_deco: {
    id: "flower_bed_deco",
    name: "Flower Border",
    layer: "floor",
    footprint: { w: 2, h: 1 },
    outdoor: true,
    blocks: false,
    portable: true,
  },
  raised_bed: {
    id: "raised_bed",
    name: "Raised Garden Bed",
    layer: "furniture",
    footprint: { w: 2, h: 2 },
    outdoor: true,
    blocks: true,
    raisedBedSlots: 4,
    portable: false,
  },
};

const HOUR = 12 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

export const PLANTS: Record<PlantVarietyId, PlantVarietyDefinition> = {
  daisy: {
    id: "daisy",
    name: "Daisy",
    family: "flower",
    maturityMs: HOUR,
    harvestItemId: "daisy_bloom",
    harvestName: "Daisy bloom",
    happinessShare: 0.25,
    starter: true,
  },
  rose: {
    id: "rose",
    name: "Rose",
    family: "flower",
    maturityMs: DAY,
    harvestItemId: "rose_bloom",
    harvestName: "Rose bloom",
    happinessShare: 0.25,
    starter: true,
  },
  lavender: {
    id: "lavender",
    name: "Lavender",
    family: "flower",
    maturityMs: DAY,
    harvestItemId: "lavender_sprig",
    harvestName: "Lavender sprig",
    happinessShare: 0.25,
    starter: true,
  },
  basil: {
    id: "basil",
    name: "Basil",
    family: "herb",
    maturityMs: HOUR,
    harvestItemId: "basil_bundle",
    harvestName: "Basil bundle",
    happinessShare: 0,
    starter: true,
  },
  lettuce: {
    id: "lettuce",
    name: "Lettuce",
    family: "vegetable",
    maturityMs: HOUR,
    harvestItemId: "lettuce_basket",
    harvestName: "Lettuce basket",
    happinessShare: 0,
    starter: true,
  },
  tomato: {
    id: "tomato",
    name: "Tomato",
    family: "vegetable",
    maturityMs: DAY,
    harvestItemId: "tomato_basket",
    harvestName: "Tomato basket",
    happinessShare: 0,
    starter: true,
  },
  space_flower: {
    id: "space_flower",
    name: "Orbital Bloom",
    family: "flower",
    maturityMs: DAY,
    harvestItemId: "space_bloom",
    harvestName: "Orbital bloom",
    happinessShare: 0.25,
    starter: false,
  },
};

export const FURNITURE_BUNDLES: Record<FurnitureBundleId, FurnitureBundleDefinition> = {
  living_room_set: {
    id: "living_room_set",
    name: "Living Room Set",
    cost: { ...ZERO_RESOURCES, coins: 20, wood: 6 },
    items: [
      { definitionId: "sofa", count: 1 },
      { definitionId: "table", count: 1 },
      { definitionId: "chair", count: 2 },
      { definitionId: "rug", count: 1 },
      { definitionId: "lamp", count: 1 },
    ],
  },
  bedroom_set: {
    id: "bedroom_set",
    name: "Bedroom Set",
    cost: { ...ZERO_RESOURCES, coins: 22, wood: 8 },
    items: [
      { definitionId: "bed", count: 1 },
      { definitionId: "shelf", count: 1 },
      { definitionId: "lamp", count: 1 },
      { definitionId: "rug", count: 1 },
      { definitionId: "wall_art", count: 1 },
    ],
  },
  study_set: {
    id: "study_set",
    name: "Study Set",
    cost: { ...ZERO_RESOURCES, coins: 18, wood: 10 },
    items: [
      { definitionId: "desk", count: 1 },
      { definitionId: "chair", count: 1 },
      { definitionId: "shelf", count: 1 },
      { definitionId: "lamp", count: 1 },
      { definitionId: "houseplant", count: 1 },
    ],
  },
};

export const STATION_MODULES: Record<StationModuleDefId, StationModuleDefinition> = {
  corridor: {
    id: "corridor",
    name: "Corridor",
    cost: {
      ...ZERO_RESOURCES,
      coins: 18,
      wood: 6,
      stone: 8,
      research: SPACE_RESEARCH_UNIT,
    },
    powerProvided: 0,
    ports: ["n", "e", "s", "w"],
    instrumentSlots: [],
    furnishable: false,
  },
  habitation: {
    id: "habitation",
    name: "Habitation Room",
    cost: {
      ...ZERO_RESOURCES,
      coins: 35,
      wood: 14,
      stone: 16,
      research: SPACE_RESEARCH_UNIT,
    },
    powerProvided: 0,
    ports: ["n", "e", "s", "w"],
    instrumentSlots: [],
    furnishable: true,
  },
  laboratory: {
    id: "laboratory",
    name: "Laboratory",
    cost: {
      ...ZERO_RESOURCES,
      coins: 40,
      wood: 12,
      stone: 20,
      research: SPACE_RESEARCH_UNIT,
    },
    powerProvided: 0,
    ports: ["n", "e", "s", "w"],
    instrumentSlots: ["survey_console"],
    furnishable: true,
  },
  greenhouse: {
    id: "greenhouse",
    name: "Greenhouse",
    cost: {
      ...ZERO_RESOURCES,
      coins: 30,
      wood: 18,
      stone: 12,
      research: SPACE_RESEARCH_UNIT,
    },
    powerProvided: 0,
    ports: ["n", "e", "s", "w"],
    instrumentSlots: ["plant_growth_chamber"],
    furnishable: true,
  },
  observatory: {
    id: "observatory",
    name: "Observatory",
    cost: {
      ...ZERO_RESOURCES,
      coins: 45,
      wood: 12,
      stone: 20,
      research: SPACE_RESEARCH_UNIT,
    },
    powerProvided: 0,
    ports: ["n", "e", "s", "w"],
    instrumentSlots: ["telescope"],
    furnishable: true,
  },
  solar_power: {
    id: "solar_power",
    name: "Solar Power Module",
    cost: {
      ...ZERO_RESOURCES,
      coins: 30,
      wood: 8,
      stone: 16,
      research: SPACE_RESEARCH_UNIT,
    },
    powerProvided: 4,
    ports: ["n", "e", "s", "w"],
    instrumentSlots: [],
    furnishable: false,
  },
};

export const INSTRUMENTS: Record<InstrumentDefId, InstrumentDefinition> = {
  telescope: {
    id: "telescope",
    name: "Telescope",
    cost: { ...INSTRUMENT_BASE_COST },
    powerCost: 1,
    fitsModules: ["observatory"],
  },
  survey_console: {
    id: "survey_console",
    name: "Survey Console",
    cost: { ...INSTRUMENT_BASE_COST },
    powerCost: 1,
    fitsModules: ["laboratory"],
  },
  plant_growth_chamber: {
    id: "plant_growth_chamber",
    name: "Plant-Growth Chamber",
    cost: { ...INSTRUMENT_BASE_COST },
    powerCost: 1,
    fitsModules: ["greenhouse"],
  },
};

export const STARTER_HOME_ITEMS: { definitionId: FurnitureDefId; count: number }[] = [
  { definitionId: "bed", count: 1 },
  { definitionId: "table", count: 1 },
  { definitionId: "chair", count: 2 },
  { definitionId: "lamp", count: 1 },
  { definitionId: "rug", count: 1 },
  { definitionId: "houseplant", count: 1 },
  { definitionId: "bench", count: 1 },
  { definitionId: "path_deco", count: 4 },
  { definitionId: "planter", count: 1 },
];

export const PORTABLE_ITEM_ALLOWLIST = new Set<string>([
  ...Object.values(FURNITURE)
    .filter((f) => f.portable)
    .map((f) => f.id),
  ...Object.values(PLANTS).map((p) => p.harvestItemId),
]);

export const EXPEDITION_BASE_REWARD: Resources = {
  ...ZERO_RESOURCES,
  coins: 6,
  wood: 3,
  stone: 3,
};

export const EXPEDITION_MAX_REWARD: Resources = {
  ...ZERO_RESOURCES,
  coins: 12,
  wood: 6,
  stone: 6,
};

export const EXPEDITION_MAX_RESEARCH = SPACE_RESEARCH_UNIT;
export const EXPEDITION_DECISIONS = 4;
export const EXPEDITION_MAP_SIZE = 7;

export type BiomeFamily = "forest" | "cave" | "river" | "coastal";

export interface EncounterTemplate {
  id: string;
  biome: BiomeFamily;
  title: string;
  description: string;
  reward: Resources;
  discovery?: string;
}

export const ENCOUNTER_TEMPLATES: EncounterTemplate[] = [
  {
    id: "forest_clearing",
    biome: "forest",
    title: "Sunny Clearing",
    description: "Wildflowers ring a quiet glade.",
    reward: { ...EXPEDITION_BASE_REWARD },
    discovery: "Pressed wildflower card",
  },
  {
    id: "forest_ridge",
    biome: "forest",
    title: "Rocky Ridge",
    description: "A ridge overlooks the canopy.",
    reward: { ...ZERO_RESOURCES, coins: 8, wood: 4, stone: 4 },
  },
  {
    id: "forest_grove",
    biome: "forest",
    title: "Mossy Grove",
    description: "Soft moss cushions every step.",
    reward: { ...ZERO_RESOURCES, coins: 6, wood: 5, stone: 2 },
    discovery: "Mossy seed packet",
  },
  {
    id: "cave_glow",
    biome: "cave",
    title: "Glow Crystal",
    description: "A soft blue crystal lights the wall.",
    reward: { ...ZERO_RESOURCES, coins: 7, stone: 5, research: 2 },
    discovery: "Glow crystal sketch",
  },
  {
    id: "cave_echo",
    biome: "cave",
    title: "Echo Chamber",
    description: "Footsteps bounce in a neat rhythm.",
    reward: { ...ZERO_RESOURCES, coins: 6, stone: 6 },
  },
  {
    id: "cave_vein",
    biome: "cave",
    title: "Stone Vein",
    description: "A neat band of workable stone.",
    reward: { ...ZERO_RESOURCES, coins: 5, stone: 6, wood: 2 },
  },
  {
    id: "river_ford",
    biome: "river",
    title: "Shallow Ford",
    description: "Smooth stones make an easy crossing.",
    reward: { ...EXPEDITION_BASE_REWARD },
  },
  {
    id: "river_willow",
    biome: "river",
    title: "Willow Bend",
    description: "Willows lean over cool water.",
    reward: { ...ZERO_RESOURCES, coins: 7, wood: 4, stone: 3 },
    discovery: "Willow cutting",
  },
  {
    id: "river_pool",
    biome: "river",
    title: "Quiet Pool",
    description: "Ripples hide tiny silver fish.",
    reward: { ...ZERO_RESOURCES, coins: 8, wood: 3, stone: 3 },
  },
  {
    id: "coast_shell",
    biome: "coastal",
    title: "Shell Beach",
    description: "Pale shells glitter in the sand.",
    reward: { ...ZERO_RESOURCES, coins: 9, stone: 3 },
    discovery: "Spiral shell",
  },
  {
    id: "coast_dune",
    biome: "coastal",
    title: "Wind Dune",
    description: "A dune crest shows the far water.",
    reward: { ...ZERO_RESOURCES, coins: 7, wood: 2, stone: 4 },
  },
  {
    id: "coast_tide",
    biome: "coastal",
    title: "Tide Pool",
    description: "Tiny life swirls in a still pool.",
    reward: { ...ZERO_RESOURCES, coins: 6, wood: 3, stone: 4, research: 1 },
  },
];

export function getFurniture(id: string): FurnitureDefinition | undefined {
  return FURNITURE[id as FurnitureDefId];
}

export function getPlant(id: string): PlantVarietyDefinition | undefined {
  return PLANTS[id as PlantVarietyId];
}

export function getBundle(id: string): FurnitureBundleDefinition | undefined {
  return FURNITURE_BUNDLES[id as FurnitureBundleId];
}

export function getStationModule(id: string): StationModuleDefinition | undefined {
  return STATION_MODULES[id as StationModuleDefId];
}

export function getInstrument(id: string): InstrumentDefinition | undefined {
  return INSTRUMENTS[id as InstrumentDefId];
}

export function isPortableGift(definitionId: string): boolean {
  return PORTABLE_ITEM_ALLOWLIST.has(definitionId);
}
