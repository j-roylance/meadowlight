import {
  EXPLORATION_HAPPINESS_COST,
  FOUNDING_LAUNCH_COST,
  FURNITURE_BUNDLES,
  GARDEN_BED_COST,
  INSTRUMENTS,
  PLANT_SLOT_COIN_COST,
  ROOM_ADD_COST,
  SPACE_CENTER_COST,
  STATION_MODULES,
  getBundle,
  getFurniture,
  getInstrument,
  getStationModule,
  isPortableGift,
  type FurnitureBundleId,
  type InstrumentDefId,
  type PlantVarietyId,
  type StationModuleDefId,
} from "@/game/catalog/expansion";
import {
  ZERO_RESOURCES,
  type CityState,
  type Resources,
} from "@/game/types";
import { canSpendAction, spendAction } from "./actions";
import { canAfford, credit, deduct } from "./economy";
import {
  addInteriorRoom,
  designatePrimaryHome,
  ensureHomeScenes,
  placeFromInventory,
  storeSceneItem,
  validateBackyardPlacement,
  validateInteriorPlacement,
} from "./home";
import { createEmptyBed, plantSlots, settleBedHarvests, settleGardens } from "./garden";
import {
  abandonExpedition,
  advanceExpedition,
  nearbyExpeditionRegions,
  previewFirstChoices,
  recallExpedition,
  startExpedition,
  syncClaimedRegions,
} from "./exploration";
import {
  applySpaceFlowerUnlock,
  astronomyEntryForLaunch,
  canStoreModule,
  createStationCore,
  hasOperationalInstrument,
  installInstrument,
  registerSpaceCenter,
  validateModuleAttachment,
} from "./space";
import { v4 as uuid } from "uuid";

export type ExpansionResult =
  | { ok: true; city: CityState; data?: unknown }
  | { ok: false; error: string; city: CityState };

function fail(city: CityState, error: string): ExpansionResult {
  return { ok: false, error, city };
}

type SpendOk = { ok: true; economy: CityState["economy"] };
type SpendResult = SpendOk | ExpansionResult;

function spend(city: CityState, cost: Resources, actions: 0 | 1): SpendResult {
  if (actions > 0) {
    if (!canSpendAction(city.economy)) return fail(city, "No actions remaining");
  }
  if (!canAfford(city.economy, cost)) return fail(city, "Cannot afford");
  let economy = deduct(city.economy, cost);
  if (actions > 0) economy = spendAction(economy);
  return { ok: true, economy };
}

function isSpendOk(r: SpendResult): r is SpendOk {
  return r.ok === true && "economy" in r;
}

export function cmdDesignateHome(
  city: CityState,
  houseEntityId: string
): ExpansionResult {
  const result = designatePrimaryHome(city, houseEntityId);
  if (!result.ok) return fail(city, result.error);
  return {
    ok: true,
    city: {
      ...result.city,
      revision: result.city.revision + 1,
      activity: [
        {
          id: uuid(),
          at: Date.now(),
          kind: "home",
          message: "Primary home designated.",
        },
        ...result.city.activity,
      ].slice(0, 40),
    },
  };
}

export function cmdSetHomePrivacy(
  city: CityState,
  privacy: "private" | "public_readonly"
): ExpansionResult {
  return {
    ok: true,
    city: {
      ...city,
      expansion: { ...city.expansion, homePrivacy: privacy },
      revision: city.revision + 1,
    },
  };
}

export function cmdAcquireBundle(
  city: CityState,
  bundleId: FurnitureBundleId,
  now: number
): ExpansionResult {
  const bundle = getBundle(bundleId) ?? FURNITURE_BUNDLES[bundleId];
  if (!bundle) return fail(city, "Unknown furnishing bundle");
  const paid = spend(city, bundle.cost, 1);
  if (!isSpendOk(paid)) return paid;
  const items = [];
  for (const entry of bundle.items) {
    for (let i = 0; i < entry.count; i++) {
      items.push({
        id: uuid(),
        kind: "furniture" as const,
        definitionId: entry.definitionId,
        quantity: 1,
        instanceId: uuid(),
      });
    }
  }
  return {
    ok: true,
    city: {
      ...city,
      economy: paid.economy,
      expansion: {
        ...city.expansion,
        inventory: [...city.expansion.inventory, ...items],
      },
      revision: city.revision + 1,
      activity: [
        {
          id: uuid(),
          at: now,
          kind: "home",
          message: `Acquired ${bundle.name}.`,
        },
        ...city.activity,
      ].slice(0, 40),
    },
  };
}

export function cmdAddInteriorRoom(
  city: CityState,
  interiorSceneId: string,
  now: number
): ExpansionResult {
  const scene = city.expansion.interiors[interiorSceneId];
  if (!scene) return fail(city, "Interior not found");
  const paid = spend(city, ROOM_ADD_COST, 1);
  if (!isSpendOk(paid)) return paid;
  const added = addInteriorRoom(scene);
  if (!added.ok) return fail(city, added.error);
  return {
    ok: true,
    city: {
      ...city,
      economy: paid.economy,
      expansion: {
        ...city.expansion,
        interiors: { ...city.expansion.interiors, [interiorSceneId]: added.scene },
      },
      revision: city.revision + 1,
      activity: [
        {
          id: uuid(),
          at: now,
          kind: "home",
          message: "Added a new room.",
        },
        ...city.activity,
      ].slice(0, 40),
    },
  };
}

export function cmdPlaceHomeItem(
  city: CityState,
  input: {
    sceneKind: "interior" | "backyard";
    sceneId: string;
    inventoryItemId: string;
    x: number;
    y: number;
    rotation: 0 | 90 | 180 | 270;
    roomId: string;
  }
): ExpansionResult {
  const placed = placeFromInventory(city.expansion, input.inventoryItemId, {
    x: input.x,
    y: input.y,
    rotation: input.rotation,
    layer: "furniture",
    roomId: input.roomId,
  });
  if (!placed.ok) return fail(city, placed.error);

  if (input.sceneKind === "interior") {
    const scene = city.expansion.interiors[input.sceneId];
    if (!scene) return fail(city, "Interior not found");
    const valid = validateInteriorPlacement(
      scene,
      placed.placement.definitionId,
      input.x,
      input.y,
      input.rotation,
      input.roomId
    );
    if (!valid.ok) return fail(city, valid.error);
    const nextScene = {
      ...scene,
      items: [...scene.items, placed.placement],
      revision: scene.revision + 1,
    };
    return {
      ok: true,
      city: {
        ...city,
        expansion: {
          ...placed.expansion,
          interiors: { ...city.expansion.interiors, [input.sceneId]: nextScene },
        },
        revision: city.revision + 1,
      },
    };
  }

  const scene = city.expansion.backyards[input.sceneId];
  if (!scene) return fail(city, "Backyard not found");
  const valid = validateBackyardPlacement(
    scene,
    placed.placement.definitionId,
    input.x,
    input.y,
    input.rotation
  );
  if (!valid.ok) return fail(city, valid.error);
  const nextScene = {
    ...scene,
    items: [...scene.items, placed.placement],
    revision: scene.revision + 1,
  };
  let nextCity: CityState = {
    ...city,
    expansion: {
      ...placed.expansion,
      backyards: { ...city.expansion.backyards, [input.sceneId]: nextScene },
    },
    revision: city.revision + 1,
  };
  nextCity = settleGardens(nextCity, Date.now());
  return { ok: true, city: nextCity };
}

export function cmdMoveHomeItem(
  city: CityState,
  input: {
    sceneKind: "interior" | "backyard";
    sceneId: string;
    itemId: string;
    x: number;
    y: number;
    rotation: 0 | 90 | 180 | 270;
    roomId: string;
    palette?: string;
  }
): ExpansionResult {
  if (input.sceneKind === "interior") {
    const scene = city.expansion.interiors[input.sceneId];
    if (!scene) return fail(city, "Interior not found");
    const item = scene.items.find((i) => i.itemId === input.itemId);
    if (!item) return fail(city, "Item not found");
    const valid = validateInteriorPlacement(
      scene,
      item.definitionId,
      input.x,
      input.y,
      input.rotation,
      input.roomId,
      item.itemId
    );
    if (!valid.ok) return fail(city, valid.error);
    const nextScene = {
      ...scene,
      items: scene.items.map((i) =>
        i.itemId === input.itemId
          ? {
              ...i,
              x: input.x,
              y: input.y,
              rotation: input.rotation,
              roomId: input.roomId,
              palette: input.palette ?? i.palette,
            }
          : i
      ),
      revision: scene.revision + 1,
    };
    return {
      ok: true,
      city: {
        ...city,
        expansion: {
          ...city.expansion,
          interiors: { ...city.expansion.interiors, [input.sceneId]: nextScene },
        },
        revision: city.revision + 1,
      },
    };
  }

  let working = settleGardens(city, Date.now());
  const scene = working.expansion.backyards[input.sceneId];
  if (!scene) return fail(city, "Backyard not found");
  const item = scene.items.find((i) => i.itemId === input.itemId);
  if (!item) return fail(city, "Item not found");
  // Settle bed harvests before move.
  let bedState = item.bedState;
  if (bedState) {
    const settled = settleBedHarvests(working.expansion, bedState, Date.now());
    working = { ...working, expansion: settled.expansion };
    bedState = settled.bed;
  }
  const valid = validateBackyardPlacement(
    scene,
    item.definitionId,
    input.x,
    input.y,
    input.rotation,
    item.itemId
  );
  if (!valid.ok) return fail(city, valid.error);
  const nextScene = {
    ...scene,
    items: scene.items.map((i) =>
      i.itemId === input.itemId
        ? {
            ...i,
            x: input.x,
            y: input.y,
            rotation: input.rotation,
            palette: input.palette ?? i.palette,
            bedState,
          }
        : i
    ),
    revision: scene.revision + 1,
  };
  working = {
    ...working,
    expansion: {
      ...working.expansion,
      backyards: { ...working.expansion.backyards, [input.sceneId]: nextScene },
    },
    revision: working.revision + 1,
  };
  working = settleGardens(working, Date.now());
  return { ok: true, city: working };
}

export function cmdStoreHomeItem(
  city: CityState,
  input: { sceneKind: "interior" | "backyard"; sceneId: string; itemId: string }
): ExpansionResult {
  let working = settleGardens(city, Date.now());
  if (input.sceneKind === "interior") {
    const scene = working.expansion.interiors[input.sceneId];
    if (!scene) return fail(city, "Interior not found");
    const item = scene.items.find((i) => i.itemId === input.itemId);
    if (!item) return fail(city, "Item not found");
    const expansion = storeSceneItem(working.expansion, item);
    return {
      ok: true,
      city: {
        ...working,
        expansion: {
          ...expansion,
          interiors: {
            ...expansion.interiors,
            [input.sceneId]: {
              ...scene,
              items: scene.items.filter((i) => i.itemId !== input.itemId),
              revision: scene.revision + 1,
            },
          },
        },
        revision: working.revision + 1,
      },
    };
  }

  const scene = working.expansion.backyards[input.sceneId];
  if (!scene) return fail(city, "Backyard not found");
  const item = scene.items.find((i) => i.itemId === input.itemId);
  if (!item) return fail(city, "Item not found");
  let bedState = item.bedState;
  if (bedState) {
    const settled = settleBedHarvests(working.expansion, bedState, Date.now());
    working = { ...working, expansion: settled.expansion };
    bedState = settled.bed;
  }
  const expansion = storeSceneItem(working.expansion, { ...item, bedState });
  let next: CityState = {
    ...working,
    expansion: {
      ...expansion,
      backyards: {
        ...expansion.backyards,
        [input.sceneId]: {
          ...scene,
          items: scene.items.filter((i) => i.itemId !== input.itemId),
          revision: scene.revision + 1,
        },
      },
    },
    revision: working.revision + 1,
  };
  next = settleGardens(next, Date.now());
  return { ok: true, city: next };
}

export function cmdBuildGardenBed(
  city: CityState,
  backyardSceneId: string,
  x: number,
  y: number,
  now: number
): ExpansionResult {
  const scene = city.expansion.backyards[backyardSceneId];
  if (!scene) return fail(city, "Backyard not found");
  const paid = spend(city, GARDEN_BED_COST, 1);
  if (!isSpendOk(paid)) return paid;
  const bedState = createEmptyBed();
  const placement = {
    itemId: uuid(),
    definitionId: "raised_bed",
    x,
    y,
    rotation: 0 as const,
    layer: "furniture",
    roomId: "backyard",
    bedState,
  };
  const valid = validateBackyardPlacement(scene, "raised_bed", x, y, 0);
  if (!valid.ok) return fail(city, valid.error);
  let next: CityState = {
    ...city,
    economy: paid.economy,
    expansion: {
      ...city.expansion,
      backyards: {
        ...city.expansion.backyards,
        [backyardSceneId]: {
          ...scene,
          items: [...scene.items, placement],
          revision: scene.revision + 1,
        },
      },
    },
    revision: city.revision + 1,
    activity: [
      {
        id: uuid(),
        at: now,
        kind: "garden",
        message: "Built a raised garden bed.",
      },
      ...city.activity,
    ].slice(0, 40),
  };
  next = settleGardens(next, now);
  return { ok: true, city: next };
}

export function cmdPlantBatch(
  city: CityState,
  input: {
    backyardSceneId: string;
    bedItemId: string;
    changes: { slotIndex: number; varietyId: PlantVarietyId | null }[];
  },
  now: number
): ExpansionResult {
  let working = settleGardens(city, now);
  const scene = working.expansion.backyards[input.backyardSceneId];
  if (!scene) return fail(city, "Backyard not found");
  const bedItem = scene.items.find((i) => i.itemId === input.bedItemId);
  if (!bedItem?.bedState) return fail(city, "Raised bed not found");

  const planted = plantSlots(bedItem.bedState, input.changes, now, working.expansion);
  if (!planted.ok) return fail(city, planted.error);

  // Uproots alone are free; planting slots cost 1 action + 2 coins each.
  const actions: 0 | 1 = planted.plantedCount > 0 ? 1 : 0;
  const coinCost: Resources = {
    ...ZERO_RESOURCES,
    coins: planted.plantedCount * PLANT_SLOT_COIN_COST,
  };
  const paid = spend({ ...working, expansion: planted.expansion }, coinCost, actions);
  if (!isSpendOk(paid)) return paid;

  const nextScene = {
    ...scene,
    items: scene.items.map((i) =>
      i.itemId === input.bedItemId ? { ...i, bedState: planted.bed } : i
    ),
    revision: scene.revision + 1,
  };
  let next: CityState = {
    ...working,
    economy: paid.economy,
    expansion: {
      ...planted.expansion,
      backyards: {
        ...planted.expansion.backyards,
        [input.backyardSceneId]: nextScene,
      },
    },
    revision: working.revision + 1,
    activity: [
      {
        id: uuid(),
        at: now,
        kind: "garden",
        message:
          planted.plantedCount > 0
            ? `Planted ${planted.plantedCount} garden slot(s).`
            : `Uprooted ${planted.uprootedCount} garden slot(s).`,
      },
      ...working.activity,
    ].slice(0, 40),
  };
  next = settleGardens(next, now);
  return { ok: true, city: next };
}

export function cmdBuildSpaceCenter(
  city: CityState,
  entityId: string
): ExpansionResult {
  const entity = city.entities.find((e) => e.id === entityId);
  if (!entity) return fail(city, "Space center not found");
  const isFinishedProject =
    entity.definitionId === "project_site" &&
    entity.appearance?.stage === "complete" &&
    entity.appearance.projectType === "space_center";
  const isLegacy = entity.definitionId === "space_center";
  if (!isFinishedProject && !isLegacy) {
    return fail(city, "Finish the Space Center project first");
  }
  return { ok: true, city: registerSpaceCenter(city, entityId) };
}

export function cmdFoundingLaunch(
  city: CityState,
  spaceCenterEntityId: string,
  launchId: string,
  now: number
): ExpansionResult {
  if (city.expansion.launchReceipts[launchId]) {
    return { ok: true, city, data: { duplicate: true } };
  }
  const entity = city.entities.find((e) => e.id === spaceCenterEntityId);
  if (!entity) return fail(city, "Space center not found");
  // Finished hosted project (or legacy direct-build) required.
  const isFinishedProject =
    entity.definitionId === "project_site" &&
    entity.appearance?.stage === "complete" &&
    entity.appearance.projectType === "space_center";
  const isLegacy = entity.definitionId === "space_center";
  if (!isFinishedProject && !isLegacy) {
    return fail(city, "Finish the Space Center project first");
  }
  let working = registerSpaceCenter(city, spaceCenterEntityId);
  const center = working.expansion.spaceCenters.find(
    (s) => s.entityId === spaceCenterEntityId
  );
  if (!center) return fail(city, "Build a space center first");
  if (center.founded || center.stationId) {
    return fail(working, "Station already founded");
  }
  city = working;
  const paid = spend(city, FOUNDING_LAUNCH_COST, 1);
  if (!isSpendOk(paid)) return paid;

  const station = createStationCore(city.id, spaceCenterEntityId);
  let expansion = {
    ...city.expansion,
    stations: { ...city.expansion.stations, [station.id]: station },
    spaceCenters: city.expansion.spaceCenters.map((s) =>
      s.entityId === spaceCenterEntityId
        ? { ...s, founded: true, stationId: station.id }
        : s
    ),
    launchReceipts: { ...city.expansion.launchReceipts, [launchId]: true as const },
  };

  if (hasOperationalInstrument(expansion, "telescope")) {
    // founding itself may not yet have telescope; later launches do
  }

  return {
    ok: true,
    city: {
      ...city,
      economy: paid.economy,
      expansion,
      revision: city.revision + 1,
      activity: [
        {
          id: uuid(),
          at: now,
          kind: "space",
          message: "Founding rocket launched — station core in orbit.",
        },
        ...city.activity,
      ].slice(0, 40),
    },
    data: { stationId: station.id, launchId },
  };
}

export function cmdLaunchModule(
  city: CityState,
  input: {
    stationId: string;
    definitionId: StationModuleDefId;
    gx: number;
    gy: number;
    rotation: 0 | 90 | 180 | 270;
    launchId: string;
  },
  now: number
): ExpansionResult {
  if (city.expansion.launchReceipts[input.launchId]) {
    return { ok: true, city, data: { duplicate: true } };
  }
  const station = city.expansion.stations[input.stationId];
  if (!station) return fail(city, "Station not found");
  const def = getStationModule(input.definitionId) ?? STATION_MODULES[input.definitionId];
  if (!def) return fail(city, "Unknown module");
  const valid = validateModuleAttachment(
    station,
    input.definitionId,
    input.gx,
    input.gy,
    input.rotation
  );
  if (!valid.ok) return fail(city, valid.error);
  const paid = spend(city, def.cost, 1);
  if (!isSpendOk(paid)) return paid;

  const module = {
    id: uuid(),
    definitionId: input.definitionId,
    gx: input.gx,
    gy: input.gy,
    rotation: input.rotation,
    stored: false,
    items: [],
    instruments: [],
  };
  let nextStation = {
    ...station,
    modules: [...station.modules, module],
    revision: station.revision + 1,
  };

  let expansion = {
    ...city.expansion,
    stations: { ...city.expansion.stations, [station.id]: nextStation },
    launchReceipts: { ...city.expansion.launchReceipts, [input.launchId]: true as const },
  };

  if (hasOperationalInstrument(expansion, "telescope")) {
    nextStation = {
      ...nextStation,
      journal: [
        ...nextStation.journal,
        astronomyEntryForLaunch(input.launchId, now),
      ],
    };
    expansion = {
      ...expansion,
      stations: { ...expansion.stations, [station.id]: nextStation },
    };
  }

  return {
    ok: true,
    city: {
      ...city,
      economy: paid.economy,
      expansion,
      revision: city.revision + 1,
      activity: [
        {
          id: uuid(),
          at: now,
          kind: "space",
          message: `Launched and installed ${def.name}.`,
        },
        ...city.activity,
      ].slice(0, 40),
    },
    data: { moduleId: module.id, launchId: input.launchId },
  };
}

export function cmdLaunchInstrument(
  city: CityState,
  input: {
    stationId: string;
    moduleId: string;
    instrumentId: InstrumentDefId;
    launchId: string;
  },
  now: number
): ExpansionResult {
  if (city.expansion.launchReceipts[input.launchId]) {
    return { ok: true, city, data: { duplicate: true } };
  }
  const station = city.expansion.stations[input.stationId];
  if (!station) return fail(city, "Station not found");
  const idef = getInstrument(input.instrumentId) ?? INSTRUMENTS[input.instrumentId];
  if (!idef) return fail(city, "Unknown instrument");
  const paid = spend(city, idef.cost, 1);
  if (!isSpendOk(paid)) return paid;
  const installed = installInstrument(station, input.moduleId, input.instrumentId);
  if (!installed.ok) return fail(city, installed.error);

  let expansion = {
    ...city.expansion,
    stations: { ...city.expansion.stations, [station.id]: installed.station },
    launchReceipts: { ...city.expansion.launchReceipts, [input.launchId]: true as const },
  };
  if (installed.unlockSpaceFlower) {
    expansion = applySpaceFlowerUnlock(expansion);
  }

  // Telescope astronomy on this instrument launch if telescope now operational
  if (
    input.instrumentId === "telescope" ||
    hasOperationalInstrument(expansion, "telescope")
  ) {
    const st = expansion.stations[station.id];
    if (st && !st.journal.some((j) => j.launchId === input.launchId)) {
      expansion = {
        ...expansion,
        stations: {
          ...expansion.stations,
          [station.id]: {
            ...st,
            journal: [...st.journal, astronomyEntryForLaunch(input.launchId, now)],
          },
        },
      };
    }
  }

  return {
    ok: true,
    city: {
      ...city,
      economy: paid.economy,
      expansion,
      revision: city.revision + 1,
      activity: [
        {
          id: uuid(),
          at: now,
          kind: "space",
          message: `Installed ${idef.name}.`,
        },
        ...city.activity,
      ].slice(0, 40),
    },
  };
}

export function cmdStoreStationModule(
  city: CityState,
  stationId: string,
  moduleId: string
): ExpansionResult {
  const station = city.expansion.stations[stationId];
  if (!station) return fail(city, "Station not found");
  const check = canStoreModule(station, moduleId);
  if (!check.ok) return fail(city, check.error);
  const next = {
    ...station,
    modules: station.modules.map((m) =>
      m.id === moduleId ? { ...m, stored: true } : m
    ),
    revision: station.revision + 1,
  };
  return {
    ok: true,
    city: {
      ...city,
      expansion: {
        ...city.expansion,
        stations: { ...city.expansion.stations, [stationId]: next },
      },
      revision: city.revision + 1,
    },
  };
}

export function cmdRestoreStationModule(
  city: CityState,
  input: {
    stationId: string;
    moduleId: string;
    gx: number;
    gy: number;
    rotation: 0 | 90 | 180 | 270;
  }
): ExpansionResult {
  const station = city.expansion.stations[input.stationId];
  if (!station) return fail(city, "Station not found");
  const mod = station.modules.find((m) => m.id === input.moduleId && m.stored);
  if (!mod || mod.definitionId === "core") return fail(city, "Module not stored");
  const valid = validateModuleAttachment(
    {
      ...station,
      modules: station.modules.map((m) =>
        m.id === input.moduleId ? { ...m, stored: true } : m
      ),
    },
    mod.definitionId,
    input.gx,
    input.gy,
    input.rotation,
    mod.id
  );
  if (!valid.ok) return fail(city, valid.error);
  const next = {
    ...station,
    modules: station.modules.map((m) =>
      m.id === input.moduleId
        ? {
            ...m,
            stored: false,
            gx: input.gx,
            gy: input.gy,
            rotation: input.rotation,
          }
        : m
    ),
    revision: station.revision + 1,
  };
  return {
    ok: true,
    city: {
      ...city,
      expansion: {
        ...city.expansion,
        stations: { ...city.expansion.stations, [input.stationId]: next },
      },
      revision: city.revision + 1,
    },
  };
}

export function cmdDispatchExpedition(
  city: CityState,
  regionKey: string,
  firstChoiceId: string,
  now: number
): ExpansionResult {
  const cost: Resources = {
    ...ZERO_RESOURCES,
    happiness: EXPLORATION_HAPPINESS_COST,
  };
  const paid = spend(city, cost, 1);
  if (!isSpendOk(paid)) return paid;
  const started = startExpedition({ ...city, economy: paid.economy }, regionKey, firstChoiceId);
  if (!started.ok) return fail(city, started.error);
  // Credit first-step reward
  const reward = started.expedition.rewards[0]?.resources ?? ZERO_RESOURCES;
  const economy = credit(paid.economy, reward);
  return {
    ok: true,
    city: {
      ...started.city,
      economy,
      revision: city.revision + 1,
      activity: [
        {
          id: uuid(),
          at: now,
          kind: "explore",
          message: `Expedition step 1/${4}: party advancing.`,
        },
        ...city.activity,
      ].slice(0, 40),
    },
    data: { expedition: started.expedition, reward },
  };
}

export function cmdExpeditionStep(
  city: CityState,
  choiceId: string,
  now: number
): ExpansionResult {
  const cost: Resources = {
    ...ZERO_RESOURCES,
    happiness: EXPLORATION_HAPPINESS_COST,
  };
  const paid = spend(city, cost, 1);
  if (!isSpendOk(paid)) return paid;
  const advanced = advanceExpedition({ ...city, economy: paid.economy }, choiceId, now);
  if (!advanced.ok) return fail(city, advanced.error);
  const economy = credit(paid.economy, advanced.reward);
  return {
    ok: true,
    city: {
      ...advanced.city,
      economy,
      revision: city.revision + 1,
      activity: [
        {
          id: uuid(),
          at: now,
          kind: "explore",
          message: advanced.expedition.status === "complete"
            ? "Outing complete — party returned."
            : `Expedition step ${advanced.expedition.stepIndex}/4.`,
        },
        ...city.activity,
      ].slice(0, 40),
    },
    data: {
      expedition: advanced.expedition,
      reward: advanced.reward,
      discovery: advanced.discovery,
    },
  };
}

export function cmdRecallExpedition(city: CityState): ExpansionResult {
  return {
    ok: true,
    city: {
      ...recallExpedition(city),
      revision: city.revision + 1,
    },
  };
}

export function cmdAbandonExpedition(city: CityState): ExpansionResult {
  return {
    ok: true,
    city: {
      ...abandonExpedition(city),
      revision: city.revision + 1,
    },
  };
}

export function cmdSendPortableItem(
  city: CityState,
  dest: CityState,
  input: {
    inventoryItemId: string;
    quantity?: number;
  }
): ExpansionResult & { dest?: CityState } {
  const item = city.expansion.inventory.find((i) => i.id === input.inventoryItemId);
  if (!item) return fail(city, "Item not in inventory");
  if (!isPortableGift(item.definitionId)) {
    return fail(city, "Item is not portable for gifting");
  }
  if (item.bedState) return fail(city, "Cannot gift growing beds");
  const qty = input.quantity ?? item.quantity;
  if (qty <= 0 || qty > item.quantity) return fail(city, "Invalid quantity");

  const paid = spend(city, ZERO_RESOURCES, 1);
  if (!isSpendOk(paid)) return paid;

  let sourceInv = city.expansion.inventory;
  if (item.quantity === qty) {
    sourceInv = sourceInv.filter((i) => i.id !== item.id);
  } else {
    sourceInv = sourceInv.map((i) =>
      i.id === item.id ? { ...i, quantity: i.quantity - qty } : i
    );
  }

  const received = {
    ...item,
    id: uuid(),
    instanceId: item.instanceId ? uuid() : undefined,
    quantity: qty,
  };

  return {
    ok: true,
    city: {
      ...city,
      economy: paid.economy,
      expansion: { ...city.expansion, inventory: sourceInv },
      revision: city.revision + 1,
    },
    dest: {
      ...dest,
      expansion: {
        ...dest.expansion,
        inventory: [...dest.expansion.inventory, received],
      },
      revision: dest.revision + 1,
    },
  };
}

export function cmdEnsureHome(city: CityState, houseEntityId: string): ExpansionResult {
  const ensured = ensureHomeScenes(city, houseEntityId);
  return {
    ok: true,
    city: {
      ...ensured.city,
      revision: ensured.city.revision === city.revision ? city.revision + 1 : ensured.city.revision + 1,
    },
    data: ensured.binding,
  };
}

export function listExplorationRegions(city: CityState) {
  return nearbyExpeditionRegions(syncClaimedRegions(city));
}

export function listFirstChoices(city: CityState, regionKey: string) {
  return previewFirstChoices(city, regionKey);
}

export { SPACE_CENTER_COST, getFurniture };
