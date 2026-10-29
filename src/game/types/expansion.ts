import type {
  BiomeFamily,
  FurnitureDefId,
  HarvestItemId,
  InstrumentDefId,
  PlantVarietyId,
  StationModuleDefId,
} from "@/game/catalog/expansion";
import type { Resources } from "./index";

export type SceneKind = "interior" | "backyard" | "station" | "expedition";

export type InventoryKind = "furniture" | "harvest" | "discovery";

export interface InventoryItem {
  id: string;
  kind: InventoryKind;
  definitionId: string;
  /** Stackable harvest/discovery counts; furniture instances use 1. */
  quantity: number;
  /** Unique furniture instance identity when placed or stored. */
  instanceId?: string;
  palette?: string;
  /** Attached garden bed state when this is a raised bed. */
  bedState?: GardenBedState;
}

export interface SceneItemPlacement {
  itemId: string;
  definitionId: FurnitureDefId | string;
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
  layer: string;
  palette?: string;
  roomId: string;
  bedState?: GardenBedState;
}

export interface InteriorRoom {
  id: string;
  /** Local origin within the house plan. */
  x: number;
  y: number;
  w: number;
  h: number;
  zone: "living" | "sleeping" | "kitchen" | "bathroom" | "addition";
  wallpaper?: string;
  flooring?: string;
}

export interface GardenPlot {
  slotIndex: 0 | 1 | 2 | 3;
  varietyId: PlantVarietyId | null;
  plantingCycleId: string | null;
  plantedAt: number | null;
  matureAt: number | null;
  harvestCredited: boolean;
}

export interface GardenBedState {
  bedId: string;
  slots: GardenPlot[];
}

export interface HomeBinding {
  houseEntityId: string;
  interiorSceneId: string;
  backyardSceneId: string;
}

export interface InteriorScene {
  id: string;
  kind: "interior";
  houseEntityId: string;
  rooms: InteriorRoom[];
  items: SceneItemPlacement[];
  revision: number;
}

export interface BackyardScene {
  id: string;
  kind: "backyard";
  houseEntityId: string;
  width: number;
  height: number;
  items: SceneItemPlacement[];
  revision: number;
}

export interface StationInstrument {
  id: string;
  definitionId: InstrumentDefId;
  moduleId: string;
  slotIndex: number;
  operational: boolean;
}

export interface StationModule {
  id: string;
  definitionId: StationModuleDefId | "core";
  gx: number;
  gy: number;
  rotation: 0 | 90 | 180 | 270;
  stored: boolean;
  items: SceneItemPlacement[];
  instruments: StationInstrument[];
}

export interface StationState {
  id: string;
  cityId: string;
  spaceCenterEntityId: string;
  coreModuleId: string;
  modules: StationModule[];
  journal: { id: string; launchId: string; text: string; at: number }[];
  revision: number;
}

export interface SpaceCenterState {
  entityId: string;
  stationId: string | null;
  founded: boolean;
}

export interface PartyMember {
  id: string;
  role: "cartographer" | "botanist" | "engineer";
  name: string;
  cosmetic: string;
}

export interface ExpeditionChoice {
  id: string;
  label: string;
  clue: string;
  targetX: number;
  targetY: number;
  encounterTemplateId: string;
}

export interface ExpeditionCell {
  x: number;
  y: number;
  revealed: boolean;
  terrain: string;
  encounterId?: string;
}

export interface ExpeditionRewardReceipt {
  stepIndex: number;
  choiceId: string;
  resources: Resources;
  discovery?: string;
  credited: boolean;
}

export interface ExpeditionInstance {
  id: string;
  regionKey: string;
  biome: BiomeFamily;
  seed: number;
  stepIndex: 0 | 1 | 2 | 3 | 4;
  partyX: number;
  partyY: number;
  revealed: ExpeditionCell[];
  availableChoices: ExpeditionChoice[];
  rewards: ExpeditionRewardReceipt[];
  journal: { at: number; text: string }[];
  status: "active" | "paused" | "complete" | "abandoned";
  specialDiscovery?: string;
}

export interface ExpeditionRegion {
  chunkKey: string;
  claimed: boolean;
  surveyed: boolean;
  biome: BiomeFamily;
  encounterSeed: number;
  attemptId?: string;
}

export interface ExpansionState {
  primaryHomeEntityId: string | null;
  homePrivacy: "private" | "public_readonly";
  grants: Record<string, true>;
  inventory: InventoryItem[];
  homes: Record<string, HomeBinding>;
  interiors: Record<string, InteriorScene>;
  backyards: Record<string, BackyardScene>;
  spaceCenters: SpaceCenterState[];
  stations: Record<string, StationState>;
  seedUnlocks: PlantVarietyId[];
  party: PartyMember[] | null;
  regions: Record<string, ExpeditionRegion>;
  activeExpedition: ExpeditionInstance | null;
  harvestReceipts: Record<string, true>;
  launchReceipts: Record<string, true>;
  /** Passive happiness from mature backyard flowers (integrated into rates). */
  backyardHappinessRate: number;
}

export function emptyExpansion(): ExpansionState {
  return {
    primaryHomeEntityId: null,
    homePrivacy: "private",
    grants: {},
    inventory: [],
    homes: {},
    interiors: {},
    backyards: {},
    spaceCenters: [],
    stations: {},
    seedUnlocks: ["daisy", "rose", "lavender", "basil", "lettuce", "tomato"],
    party: null,
    regions: {},
    activeExpedition: null,
    harvestReceipts: {},
    launchReceipts: {},
    backyardHappinessRate: 0,
  };
}

export type ActiveSceneView =
  | { kind: "city" }
  | { kind: "interior"; sceneId: string; houseEntityId: string }
  | { kind: "backyard"; sceneId: string; houseEntityId: string }
  | { kind: "station"; stationId: string }
  | { kind: "expedition"; expeditionId: string };

export type { HarvestItemId };
