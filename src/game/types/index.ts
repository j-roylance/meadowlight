export type Specialty = "markets" | "wood" | "stone";
export type ResourceKey = "coins" | "wood" | "stone" | "research" | "happiness";

export type Resources = Record<ResourceKey, number>;

export const ZERO_RESOURCES: Resources = {
  coins: 0,
  wood: 0,
  stone: 0,
  research: 0,
  happiness: 0,
};

export type BuildingDefId =
  | "town_hall"
  | "cottage_a"
  | "cottage_b"
  | "cottage_c"
  | "wood_workshop"
  | "stone_yard"
  | "neighborhood_market"
  | "flower_garden"
  | "pocket_park"
  | "portal"
  | "project_site"
  | "space_center"
  | "landmark_park"
  | "landmark_museum"
  | "landmark_rec"
  | "landmark_tower"
  | "landmark_university"
  | "landmark_bank"
  | "landmark_space_center";

export type { ExpansionState, ActiveSceneView } from "./expansion";
export {
  emptyExpansion,
} from "./expansion";
export type {
  InventoryItem,
  SceneItemPlacement,
  InteriorRoom,
  GardenPlot,
  GardenBedState,
  HomeBinding,
  InteriorScene,
  BackyardScene,
  StationState,
  StationModule,
  StationInstrument,
  SpaceCenterState,
  PartyMember,
  ExpeditionInstance,
  ExpeditionRegion,
  ExpeditionChoice,
} from "./expansion";

export type ProjectDefId =
  | "riverside_park"
  | "community_museum"
  | "municipal_rec"
  | "skyline_tower"
  | "community_university"
  | "town_bank"
  | "space_center";

export type TerrainKind =
  | "grass"
  | "grass_flowers"
  | "water"
  | "sand"
  | "tree"
  | "stone_pile"
  | "path";

export interface Footprint {
  w: number;
  h: number;
}

export interface YieldRates {
  coins: number;
  wood: number;
  stone: number;
  research: number;
  happiness: number;
}

export interface BuildingDefinition {
  id: BuildingDefId;
  name: string;
  category: "house" | "town" | "portal" | "project" | "cosmetic";
  footprint: Footprint;
  cost: Resources;
  level1: { yield: YieldRates; residents: number; amenity: number };
  level2?: { yield: YieldRates; residents: number; amenity: number };
  upgradeable: boolean;
  stylable?: boolean;
  styleGroup?: string;
}

export interface ProjectDefinition {
  id: ProjectDefId;
  name: string;
  workRequired: number;
  /** Coins spent with 1 action when placing / starting the site. */
  startCoins: number;
  /** Research spent when placing / starting the site (0 for most projects). */
  startResearch: number;
  /** Materials spent per work contribution after start (no action cost). */
  workCost: { wood: number; stone: number; research: number };
  landmarkBlueprint: BuildingDefId;
  description: string;
}

export interface WorldCoord {
  x: bigint;
  y: bigint;
}

export interface ChunkCoord {
  cx: bigint;
  cy: bigint;
}

export interface LocalCoord {
  lx: number;
  ly: number;
}

export interface TileRef {
  chunk: ChunkCoord;
  local: LocalCoord;
}

export interface PlacedEntity {
  id: string;
  definitionId: BuildingDefId;
  level: 1 | 2;
  /** World tile of footprint origin (min x, min y). */
  x: bigint;
  y: bigint;
  rotation: 0 | 90 | 180 | 270;
  stored: boolean;
  appearance?: Record<string, string>;
  revision: number;
}

export interface PortalState {
  entityId: string;
  destinationCityId: string;
  assignmentRevision: number;
  enabled: boolean;
}

export interface RoadTile {
  x: bigint;
  y: bigint;
  style: "dirt" | "stone";
}

export interface HostedProject {
  id: string;
  definitionId: ProjectDefId;
  entityId: string;
  workCurrent: number;
  status: "untouched" | "active" | "complete";
  completedAt?: number;
  contributors: { cityId: string; cityName: string; work: number }[];
}

export interface EconomyState {
  coins: number;
  wood: number;
  stone: number;
  research: number;
  happiness: number;
  remCoins: number;
  remWood: number;
  remStone: number;
  remResearch: number;
  remHappiness: number;
  rateCoins: number;
  rateWood: number;
  rateStone: number;
  rateResearch: number;
  rateHappiness: number;
  lastSettledAt: number;
  actionsRemaining: 0 | 1 | 2;
  actionWindowStartAt: number;
}

export interface ActivityEvent {
  id: string;
  at: number;
  kind: string;
  message: string;
}

export interface BlueprintEntitlement {
  type: BuildingDefId;
  provenance: string;
}

export interface Friendship {
  otherCityId: string;
  status: "pending" | "accepted";
  initiatedByMe: boolean;
}

export interface CircleState {
  id: string;
  name: string;
  memberCityIds: string[];
  invites: { tokenPreview: string; revoked: boolean }[];
}

export interface DeliveryPolicy {
  inboundEnabled: boolean;
  blockedSourceCityIds: string[];
}

export interface CommercePair {
  cityA: string;
  cityB: string;
  portalCount: number;
  specialtyA: Specialty;
  specialtyB: Specialty;
}

export interface CityState {
  id: string;
  ownerId: string;
  name: string;
  displayName: string;
  specialty: Specialty;
  seed: number;
  generatorVersion: 1;
  createdAt: number;
  revision: number;
  arrivalX: bigint;
  arrivalY: bigint;
  economy: EconomyState;
  entities: PlacedEntity[];
  roads: RoadTile[];
  portals: PortalState[];
  projects: HostedProject[];
  blueprints: BlueprintEntitlement[];
  friendships: Friendship[];
  circle: CircleState | null;
  delivery: DeliveryPolicy;
  activity: ActivityEvent[];
  returnSummary: string | null;
  onboardingComplete: boolean;
  /** Harvested / edited tiles — overrides generated terrain. */
  terrainOverrides: Record<string, TerrainKind>;
  /** Home, garden, space, and exploration systems (additive). */
  expansion: import("./expansion").ExpansionState;
}

export interface DirectoryEntry {
  cityId: string;
  name: string;
  displayName: string;
  specialty: Specialty;
  population: number;
  amenity: number;
  projectStatus: string;
  simulated?: boolean;
}

export interface CommandResult<T = unknown> {
  ok: boolean;
  error?: string;
  data?: T;
  city?: CityState;
}

export type ToolMode =
  | "inspect"
  | "build"
  | "road"
  | "erase_road"
  | "portal"
  | "project"
  | "move"
  | "store";

export const WINDOW_MS = 12 * 60 * 60 * 1000; // 43_200_000
export const CHUNK_SIZE = 32;
export const MAX_ROAD_PATH = 16;
export const WORK_COST: Resources = {
  coins: 0,
  wood: 5,
  stone: 5,
  research: 0,
  happiness: 0,
};
export const HARVEST_WOOD = 25;
export const HARVEST_STONE = 25;
/** Per-bank exchange unit. Each placed bank multiplies this batch size. */
export const BANK_EXCHANGE_AMOUNT = 100;
export const CATALOG_VERSION = "1.1.1";
