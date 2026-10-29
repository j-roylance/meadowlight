import type {
  CityState,
  CommandResult,
  DirectoryEntry,
  Resources,
  Specialty,
  WorldCoord,
  BuildingDefId,
  ProjectDefId,
  ExpeditionRegion,
  ExpeditionChoice,
} from "@/game/types";
import type {
  FurnitureBundleId,
  InstrumentDefId,
  PlantVarietyId,
  StationModuleDefId,
} from "@/game/catalog/expansion";

export type GameMode = "local_demo" | "multiplayer";

export interface GameService {
  mode: GameMode;
  modeLabel: string;

  syncMyCity(now?: number): Promise<CommandResult<CityState>>;
  createCity(input: {
    name: string;
    displayName: string;
    specialty: Specialty;
  }): Promise<CommandResult<CityState>>;

  listPlayerMaps(opts?: {
    query?: string;
    filter?: "all" | "friends" | "circle";
    cursor?: string;
  }): Promise<CommandResult<{ entries: DirectoryEntry[]; nextCursor?: string }>>;

  readCitySummary(cityId: string): Promise<CommandResult<CityState>>;

  placeBuilding(input: {
    requestId: string;
    expectedRevision: number;
    definitionId: BuildingDefId;
    x: bigint;
    y: bigint;
  }): Promise<CommandResult>;

  upgradeBuilding(input: {
    requestId: string;
    expectedRevision: number;
    entityId: string;
  }): Promise<CommandResult>;

  buildRoadPath(input: {
    requestId: string;
    expectedRevision: number;
    path: WorldCoord[];
  }): Promise<CommandResult>;

  eraseOwnedRoads(input: {
    requestId: string;
    expectedRevision: number;
    tiles: WorldCoord[];
  }): Promise<CommandResult>;

  repositionEntity(input: {
    requestId: string;
    expectedRevision: number;
    entityId: string;
    x: bigint;
    y: bigint;
  }): Promise<CommandResult>;

  storeEntity(input: {
    requestId: string;
    expectedRevision: number;
    entityId: string;
  }): Promise<CommandResult>;

  restoreEntity(input: {
    requestId: string;
    expectedRevision: number;
    entityId: string;
    x: bigint;
    y: bigint;
  }): Promise<CommandResult>;

  createAssignedPortal(input: {
    requestId: string;
    expectedRevision: number;
    x: bigint;
    y: bigint;
    destinationCityId: string;
  }): Promise<CommandResult>;

  reassignPortal(input: {
    requestId: string;
    expectedRevision: number;
    portalEntityId: string;
    expectedAssignmentRevision: number;
    destinationCityId: string;
  }): Promise<CommandResult>;

  sendResourceParcel(input: {
    requestId: string;
    expectedRevision: number;
    portalEntityId: string;
    expectedAssignmentRevision: number;
    destinationCityId: string;
    amounts: Resources;
  }): Promise<CommandResult>;

  sendProjectWork(input: {
    requestId: string;
    expectedRevision: number;
    portalEntityId: string;
    expectedAssignmentRevision: number;
    destinationCityId: string;
    projectId: string;
  }): Promise<CommandResult>;

  contributeToOwnProject(input: {
    requestId: string;
    expectedRevision: number;
    projectId: string;
  }): Promise<CommandResult>;

  takeSupplyRun(input: {
    requestId: string;
    expectedRevision: number;
    resource: keyof Resources;
  }): Promise<CommandResult>;

  harvestTile(input: {
    requestId: string;
    expectedRevision: number;
    x: bigint;
    y: bigint;
  }): Promise<CommandResult>;

  /** Bank exchange (1 action). Batch size scales with number of banks; rates vary by pair. */
  bankExchange(input: {
    requestId: string;
    expectedRevision: number;
    entityId: string;
    from: keyof Resources;
    to: keyof Resources;
  }): Promise<CommandResult>;

  startHostedProject(input: {
    requestId: string;
    expectedRevision: number;
    definitionId: ProjectDefId;
    x: bigint;
    y: bigint;
  }): Promise<CommandResult>;

  cancelUntouchedProject(input: {
    requestId: string;
    expectedRevision: number;
    projectId: string;
  }): Promise<CommandResult>;

  placeLandmark(input: {
    requestId: string;
    expectedRevision: number;
    definitionId: BuildingDefId;
    x: bigint;
    y: bigint;
  }): Promise<CommandResult>;

  setInboundDeliveryPolicy(input: {
    requestId: string;
    expectedRevision: number;
    inboundEnabled: boolean;
  }): Promise<CommandResult>;

  completeOnboarding(input: {
    name: string;
    specialty: Specialty;
  }): Promise<CommandResult>;

  /** Free rename of your own city (also toggles demo tools when named "demo"). */
  renameCity(input: {
    requestId: string;
    expectedRevision: number;
    name: string;
  }): Promise<CommandResult>;

  /** Demo-only: advance simulated clock. */
  demoAdvanceHours?(hours: number): Promise<CommandResult>;
  demoReset?(): Promise<CommandResult>;
  /** Demo-only: simulated neighbor contributes to your project. */
  demoSimulatedContribution?(projectId: string): Promise<CommandResult>;
  /** Demo-only: add to every resource balance (default +100). */
  demoGrantResources?(amount?: number): Promise<CommandResult>;
  /** Demo-only: set every resource to a large demo stockpile. */
  demoFillResources?(amount?: number): Promise<CommandResult>;

  // --- Expansion: home / garden / space / exploration ---

  designatePrimaryHome(input: {
    requestId: string;
    expectedRevision: number;
    houseEntityId: string;
  }): Promise<CommandResult>;

  setHomePrivacy(input: {
    requestId: string;
    expectedRevision: number;
    privacy: "private" | "public_readonly";
  }): Promise<CommandResult>;

  acquireFurnitureBundle(input: {
    requestId: string;
    expectedRevision: number;
    bundleId: FurnitureBundleId;
  }): Promise<CommandResult>;

  addInteriorRoom(input: {
    requestId: string;
    expectedRevision: number;
    interiorSceneId: string;
  }): Promise<CommandResult>;

  placeHomeItem(input: {
    requestId: string;
    expectedRevision: number;
    sceneKind: "interior" | "backyard";
    sceneId: string;
    inventoryItemId: string;
    x: number;
    y: number;
    rotation: 0 | 90 | 180 | 270;
    roomId: string;
  }): Promise<CommandResult>;

  moveHomeItem(input: {
    requestId: string;
    expectedRevision: number;
    sceneKind: "interior" | "backyard";
    sceneId: string;
    itemId: string;
    x: number;
    y: number;
    rotation: 0 | 90 | 180 | 270;
    roomId: string;
    palette?: string;
  }): Promise<CommandResult>;

  storeHomeItem(input: {
    requestId: string;
    expectedRevision: number;
    sceneKind: "interior" | "backyard";
    sceneId: string;
    itemId: string;
  }): Promise<CommandResult>;

  buildGardenBed(input: {
    requestId: string;
    expectedRevision: number;
    backyardSceneId: string;
    x: number;
    y: number;
  }): Promise<CommandResult>;

  plantGardenBatch(input: {
    requestId: string;
    expectedRevision: number;
    backyardSceneId: string;
    bedItemId: string;
    changes: { slotIndex: number; varietyId: PlantVarietyId | null }[];
  }): Promise<CommandResult>;

  foundingLaunch(input: {
    requestId: string;
    expectedRevision: number;
    spaceCenterEntityId: string;
    launchId: string;
  }): Promise<CommandResult>;

  launchStationModule(input: {
    requestId: string;
    expectedRevision: number;
    stationId: string;
    definitionId: StationModuleDefId;
    gx: number;
    gy: number;
    rotation: 0 | 90 | 180 | 270;
    launchId: string;
  }): Promise<CommandResult>;

  launchInstrument(input: {
    requestId: string;
    expectedRevision: number;
    stationId: string;
    moduleId: string;
    instrumentId: InstrumentDefId;
    launchId: string;
  }): Promise<CommandResult>;

  storeStationModule(input: {
    requestId: string;
    expectedRevision: number;
    stationId: string;
    moduleId: string;
  }): Promise<CommandResult>;

  restoreStationModule(input: {
    requestId: string;
    expectedRevision: number;
    stationId: string;
    moduleId: string;
    gx: number;
    gy: number;
    rotation: 0 | 90 | 180 | 270;
  }): Promise<CommandResult>;

  listExpeditionRegions(): Promise<
    CommandResult<{ regions: ExpeditionRegion[] }>
  >;

  previewExpeditionChoices(input: {
    regionKey: string;
  }): Promise<CommandResult<{ choices: ExpeditionChoice[] }>>;

  dispatchExpedition(input: {
    requestId: string;
    expectedRevision: number;
    regionKey: string;
    firstChoiceId: string;
  }): Promise<CommandResult>;

  expeditionStep(input: {
    requestId: string;
    expectedRevision: number;
    choiceId: string;
  }): Promise<CommandResult>;

  recallExpedition(input: {
    requestId: string;
    expectedRevision: number;
  }): Promise<CommandResult>;

  abandonExpedition(input: {
    requestId: string;
    expectedRevision: number;
  }): Promise<CommandResult>;

  sendPortableItem(input: {
    requestId: string;
    expectedRevision: number;
    portalEntityId: string;
    expectedAssignmentRevision: number;
    destinationCityId: string;
    inventoryItemId: string;
    quantity?: number;
  }): Promise<CommandResult>;
}
