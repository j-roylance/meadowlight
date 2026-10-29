import { v4 as uuid } from "uuid";
import {
  getBuilding,
  getProject,
  tryGetProject,
  PROJECTS,
  upgradeCost,
} from "@/game/catalog/definitions";
import { spendAction, canSpendAction } from "@/game/simulation/actions";
import {
  applyRates,
  canAfford,
  computeBuildingRates,
  commerceYieldForSpecialty,
  credit,
  deduct,
  settleCity,
} from "@/game/simulation/economy";
import { validatePlacement, validateRoadTile } from "@/game/simulation/placement";
import { clearHarvestablesUnder, tryHarvest } from "@/game/simulation/harvest";
import { roadSet, validateRoadPath } from "@/game/simulation/roads";
import { applyWork } from "@/game/simulation/projects";
import { createStarterCity } from "@/game/simulation/starter";
import { tileKey } from "@/game/simulation/coords";
import { bankCostGain, countBanks, isBankEntity } from "@/game/simulation/bank";
import {
  ZERO_RESOURCES,
  emptyExpansion,
  type CityState,
  type CommandResult,
  type DirectoryEntry,
  type ResourceKey,
  type Resources,
} from "@/game/types";
import {
  cmdAbandonExpedition,
  cmdAcquireBundle,
  cmdAddInteriorRoom,
  cmdBuildGardenBed,
  cmdDesignateHome,
  cmdDispatchExpedition,
  cmdExpeditionStep,
  cmdFoundingLaunch,
  cmdLaunchInstrument,
  cmdLaunchModule,
  cmdMoveHomeItem,
  cmdPlaceHomeItem,
  cmdPlantBatch,
  cmdRecallExpedition,
  cmdRestoreStationModule,
  cmdSendPortableItem,
  cmdSetHomePrivacy,
  cmdStoreHomeItem,
  cmdStoreStationModule,
  listExplorationRegions,
  listFirstChoices,
} from "@/game/simulation/expansionCommands";
import { registerSpaceCenter } from "@/game/simulation/space";
import { isSpaceCenterEntity } from "@/game/simulation/spaceCenter";
import { syncClaimedRegions } from "@/game/simulation/exploration";
import type { GameMode, GameService } from "@/game/adapters/types";
import type {
  FurnitureBundleId,
  InstrumentDefId,
  PlantVarietyId,
  StationModuleDefId,
} from "@/game/catalog/expansion";
import { isDemoMapName } from "@/game/demoMap";

export interface WorldStore {
  player: CityState;
  neighbors: CityState[];
  clockOffsetMs: number;
  receipts: Record<string, CommandResult>;
  commerce: { a: string; b: string; count: number; specA: string; specB: string }[];
}

export interface WorldPersistence {
  load(): WorldStore | null;
  save(store: WorldStore): void;
}

export interface WorldServiceOptions {
  mode: GameMode;
  modeLabel: string;
  persistence: WorldPersistence;
  /** Used when persistence.load() returns null. */
  createInitialStore: (now: number) => WorldStore;
  /**
   * demo_gated: simulated neighbors only when city named "demo".
   * all_neighbors: always list store.neighbors (multiplayer request-scoped loads).
   */
  directoryMode?: "demo_gated" | "all_neighbors";
  enableDemoTools?: boolean;
  /** Wipe hook for demoReset (localStorage). */
  onHardReset?: () => void;
}

function pairKey(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function migrateCity(city: CityState): CityState {
  const e = city.economy ?? ({} as CityState["economy"]);
  const expansion = city.expansion
    ? {
        ...emptyExpansion(),
        ...city.expansion,
        grants: city.expansion.grants ?? {},
        inventory: city.expansion.inventory ?? [],
        homes: city.expansion.homes ?? {},
        interiors: city.expansion.interiors ?? {},
        backyards: city.expansion.backyards ?? {},
        spaceCenters: city.expansion.spaceCenters ?? [],
        stations: city.expansion.stations ?? {},
        seedUnlocks: city.expansion.seedUnlocks ?? emptyExpansion().seedUnlocks,
        regions: city.expansion.regions ?? {},
        harvestReceipts: city.expansion.harvestReceipts ?? {},
        launchReceipts: city.expansion.launchReceipts ?? {},
      }
    : emptyExpansion();
  return {
    ...city,
    terrainOverrides: city.terrainOverrides ?? {},
    expansion,
    economy: {
      ...e,
      research: e.research ?? 0,
      happiness: e.happiness ?? 0,
      remResearch: e.remResearch ?? 0,
      remHappiness: e.remHappiness ?? 0,
      rateResearch: e.rateResearch ?? 0,
      rateHappiness: e.rateHappiness ?? 0,
      // Never overwrite present balances — only fill absences above.
    },
  };
}

export function makeNeighbors(now: number): CityState[] {
  return [
    createStarterCity({
      id: "sim-willow",
      ownerId: "sim-owner-willow",
      name: "Willow Bend",
      displayName: "Willow (simulated)",
      specialty: "wood",
      now,
      seed: 42,
    }),
    createStarterCity({
      id: "sim-amber",
      ownerId: "sim-owner-amber",
      name: "Amber Hollow",
      displayName: "Amber (simulated)",
      specialty: "markets",
      now,
      seed: 99,
    }),
    createStarterCity({
      id: "sim-pebble",
      ownerId: "sim-owner-pebble",
      name: "Pebble Creek",
      displayName: "Pebble (simulated)",
      specialty: "stone",
      now,
      seed: 7,
    }),
  ].map((c) => ({
    ...c,
    onboardingComplete: true,
    activity: [
      {
        id: "sim",
        at: now,
        kind: "info",
        message: "Simulated neighbor city — Local demo only.",
      },
    ],
  }));
}

function refreshRates(store: WorldStore, city: CityState): CityState {
  const building = computeBuildingRates(city);
  let commerce: Resources = { ...ZERO_RESOURCES };
  for (const pair of store.commerce) {
    if (pair.count <= 0) continue;
    if (pair.a !== city.id && pair.b !== city.id) continue;
    const partnerSpec = pair.a === city.id ? pair.specB : pair.specA;
    const y = commerceYieldForSpecialty(partnerSpec as "markets" | "wood" | "stone");
    commerce = {
      coins: commerce.coins + y.coins,
      wood: commerce.wood + y.wood,
      stone: commerce.stone + y.stone,
      research: commerce.research + y.research,
      happiness: commerce.happiness + y.happiness,
    };
  }
  return { ...city, economy: applyRates(city.economy, building, commerce) };
}

function bumpCommerce(
  store: WorldStore,
  sourceId: string,
  destId: string,
  delta: number
) {
  const [a, b] = pairKey(sourceId, destId);
  let pair = store.commerce.find((p) => p.a === a && p.b === b);
  if (!pair && delta > 0) {
    const src = findCity(store, sourceId)!;
    const dst = findCity(store, destId)!;
    pair = {
      a,
      b,
      count: 0,
      specA: a === sourceId ? src.specialty : dst.specialty,
      specB: b === destId ? dst.specialty : src.specialty,
    };
    // Snapshot specialties at activation
    if (a === sourceId) {
      pair.specA = src.specialty;
      pair.specB = dst.specialty;
    } else {
      pair.specA = dst.specialty;
      pair.specB = src.specialty;
    }
    store.commerce.push(pair);
  }
  if (pair) pair.count = Math.max(0, pair.count + delta);
}

function findCity(store: WorldStore, id: string): CityState | undefined {
  if (store.player.id === id) return store.player;
  return store.neighbors.find((n) => n.id === id);
}

function setCity(store: WorldStore, city: CityState) {
  if (city.id === store.player.id) store.player = city;
  else {
    const i = store.neighbors.findIndex((n) => n.id === city.id);
    if (i >= 0) store.neighbors[i] = city;
    else store.neighbors.push(city);
  }
}

function summaryMessage(earned: Resources, city: CityState): string {
  const parts: string[] = [];
  if (earned.coins || earned.wood || earned.stone) {
    parts.push(
      `While away: +${earned.coins} coins, +${earned.wood} wood, +${earned.stone} stone, +${earned.research} research, +${earned.happiness} happiness.`
    );
  }
  const active = city.projects.find((p) => p.status !== "complete");
  if (active) {
    const def = tryGetProject(active.definitionId);
    if (def) {
      parts.push(
        `${def.name}: ${active.workCurrent}/${def.workRequired} work.`
      );
    }
  }
  if (city.economy.actionsRemaining === 0) {
    parts.push("Actions spent — browse freely until the next window.");
  } else {
    parts.push(
      `${city.economy.actionsRemaining}/2 actions ready. Two actions per twelve-hour window. Unused actions do not carry over.`
    );
  }
  return parts.join(" ");
}

export function createWorldService(options: WorldServiceOptions): GameService {
  const directoryMode = options.directoryMode ?? "demo_gated";
  const enableDemoTools = options.enableDemoTools ?? false;
  let store: WorldStore | null = null;

  const now = () => Date.now() + (store?.clockOffsetMs ?? 0);

  const ensure = (): WorldStore => {
    if (store) return store;
    store = options.persistence.load();
    if (!store) {
      store = options.createInitialStore(Date.now());
      options.persistence.save(store);
    }
    store.player = migrateCity(store.player);
    store.neighbors = store.neighbors.map(migrateCity);
    return store;
  };

  const save = (s: WorldStore) => {
    options.persistence.save(s);
  };

  const idempotent = (
    requestId: string,
    run: () => CommandResult
  ): CommandResult => {
    const s = ensure();
    if (s.receipts[requestId]) return s.receipts[requestId];
    const result = run();
    s.receipts[requestId] = result;
    save(s);
    return result;
  };

  const withSettledPlayer = (): { city: CityState; earned: Resources } => {
    const s = ensure();
    const settled = settleCity(s.player, now());
    s.player = refreshRates(s, {
      ...settled.city,
      returnSummary: summaryMessage(settled.earned, settled.city),
    });
    save(s);
    return { city: s.player, earned: settled.earned };
  };

  const service: GameService = {
    mode: options.mode,
    modeLabel: options.modeLabel,

    async syncMyCity() {
      const { city } = withSettledPlayer();
      return { ok: true, city, data: city };
    },

    async createCity(input) {
      const s = ensure();
      const t = now();
      const prev = s.player;
      s.player = createStarterCity({
        id: prev.id,
        ownerId: prev.ownerId,
        name: input.name,
        displayName: input.displayName,
        specialty: input.specialty,
        now: t,
        seed: prev.seed,
      });
      s.player.onboardingComplete = true;
      if (directoryMode === "demo_gated") {
        s.neighbors = makeNeighbors(t);
        s.commerce = [];
      }
      s.receipts = {};
      save(s);
      return { ok: true, city: s.player, data: s.player };
    },

    async completeOnboarding(input) {
      const s = ensure();
      s.player = {
        ...s.player,
        name: input.name.trim() || "Meadowlight",
        specialty: input.specialty,
        onboardingComplete: true,
      };
      save(s);
      return { ok: true, city: s.player };
    },

    async renameCity(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        const name = input.name.trim();
        if (!name) return { ok: false, error: "Name required", city };
        if (name.length > 40) return { ok: false, error: "Name too long", city };
        city = {
          ...city,
          name,
          revision: city.revision + 1,
          activity: [
            {
              id: uuid(),
              at: now(),
              kind: "rename",
              message: isDemoMapName(name)
                ? `City renamed to ${name} — demo tools unlocked.`
                : `City renamed to ${name}.`,
            },
            ...city.activity,
          ].slice(0, 40),
        };
        s.player = city;
        return { ok: true, city };
      });
    },

    async listPlayerMaps(opts) {
      const s = ensure();
      withSettledPlayer();
      const showNeighbors =
        directoryMode === "all_neighbors" || isDemoMapName(s.player.name);
      const all: DirectoryEntry[] = showNeighbors
        ? s.neighbors.map((n) => ({
            cityId: n.id,
            name: n.name,
            displayName: n.displayName,
            specialty: n.specialty,
            population: 8,
            amenity: 4,
            projectStatus:
              n.projects[0]?.status === "complete"
                ? "Complete"
                : `${n.projects[0]?.workCurrent ?? 0} work`,
            simulated: directoryMode === "demo_gated",
          }))
        : [];
      let entries = all;
      if (opts?.query) {
        const q = opts.query.toLowerCase();
        entries = entries.filter(
          (e) =>
            e.name.toLowerCase().includes(q) ||
            e.displayName.toLowerCase().includes(q)
        );
      }
      if (opts?.filter === "friends") {
        const friendIds = new Set(
          s.player.friendships
            .filter((f) => f.status === "accepted")
            .map((f) => f.otherCityId)
        );
        entries = entries.filter((e) => friendIds.has(e.cityId));
      }
      return { ok: true, data: { entries } };
    },

    async readCitySummary(cityId) {
      const s = ensure();
      const city = findCity(s, cityId);
      if (!city) return { ok: false, error: "City not found" };
      // Public visit — strip private economy / inventory / hidden expedition seeds
      if (cityId !== s.player.id) {
        const showHome = city.expansion?.homePrivacy === "public_readonly";
        const publicCity: CityState = {
          ...city,
          economy: {
            ...city.economy,
            coins: 0,
            wood: 0,
            stone: 0,
            research: 0,
            happiness: 0,
            actionsRemaining: 0,
          },
          expansion: {
            ...emptyExpansion(),
            primaryHomeEntityId: showHome ? city.expansion.primaryHomeEntityId : null,
            homePrivacy: city.expansion?.homePrivacy ?? "private",
            homes: showHome ? city.expansion.homes : {},
            interiors: showHome ? city.expansion.interiors : {},
            backyards: showHome ? city.expansion.backyards : {},
            // Stations: exterior silhouette only — no inventory / party
            spaceCenters: city.expansion?.spaceCenters ?? [],
            stations: city.expansion?.stations ?? {},
            backyardHappinessRate: 0,
          },
        };
        return { ok: true, city: publicCity, data: publicCity };
      }
      return { ok: true, city, data: city };
    },

    async placeBuilding(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        if (!canSpendAction(city.economy)) {
          return { ok: false, error: "No actions remaining", city };
        }
        const def = getBuilding(input.definitionId);
        if (def.category === "portal" || def.category === "project") {
          return { ok: false, error: "Use dedicated portal/project commands", city };
        }
        if (def.id === "town_hall") {
          return { ok: false, error: "Town hall is starting-only", city };
        }
        if (def.id === "space_center") {
          return {
            ok: false,
            error: "Space Center is a hosted project — start it from Projects",
            city,
          };
        }
        if (!canAfford(city.economy, def.cost)) {
          return { ok: false, error: "Cannot afford", city };
        }
        const place = validatePlacement(city, input.definitionId, input.x, input.y);
        if (!place.ok) return { ok: false, error: place.reason, city };

        city = {
          ...city,
          economy: spendAction(deduct(city.economy, def.cost)),
          terrainOverrides: clearHarvestablesUnder(city, place.tiles),
          entities: [
            ...city.entities,
            {
              id: uuid(),
              definitionId: input.definitionId,
              level: 1,
              x: input.x,
              y: input.y,
              rotation: 0,
              stored: false,
              revision: 1,
            },
          ],
          revision: city.revision + 1,
          activity: [
            {
              id: uuid(),
              at: now(),
              kind: "build",
              message: `Built ${def.name}.`,
            },
            ...city.activity,
          ].slice(0, 40),
        };
        city = syncClaimedRegions(city);
        city = refreshRates(s, city);
        s.player = city;
        return { ok: true, city };
      });
    },

    async upgradeBuilding(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        const entity = city.entities.find((e) => e.id === input.entityId);
        if (!entity || entity.stored) return { ok: false, error: "Entity not found", city };
        const def = getBuilding(entity.definitionId);
        if (!def.upgradeable || entity.level >= 2) {
          return { ok: false, error: "Cannot upgrade", city };
        }
        if (!canSpendAction(city.economy)) {
          return { ok: false, error: "No actions remaining", city };
        }
        const cost = upgradeCost(def);
        if (!canAfford(city.economy, cost)) {
          return { ok: false, error: "Cannot afford upgrade", city };
        }
        city = {
          ...city,
          economy: spendAction(deduct(city.economy, cost)),
          entities: city.entities.map((e) =>
            e.id === entity.id ? { ...e, level: 2 as const, revision: e.revision + 1 } : e
          ),
          revision: city.revision + 1,
        };
        city = refreshRates(s, city);
        s.player = city;
        return { ok: true, city };
      });
    },

    async buildRoadPath(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        for (const t of input.path) {
          const v = validateRoadTile(city, t.x, t.y);
          if (!v.ok) return { ok: false, error: v.reason, city };
        }
        const existing = roadSet(city.roads);
        const check = validateRoadPath(input.path, existing);
        if (!check.ok) return { ok: false, error: check.error, city };
        if (check.newTiles.length === 0) {
          return { ok: true, city }; // free no-op
        }
        if (!canSpendAction(city.economy)) {
          return { ok: false, error: "No actions remaining", city };
        }
        const cost: Resources = { coins: 0, wood: 0, stone: check.stoneCost, research: 0 , happiness: 0 };
        if (!canAfford(city.economy, cost)) {
          return { ok: false, error: "Not enough stone", city };
        }
        city = {
          ...city,
          economy: spendAction(deduct(city.economy, cost)),
          roads: [
            ...city.roads,
            ...check.newTiles.map((t) => ({ x: t.x, y: t.y, style: "dirt" as const })),
          ],
          revision: city.revision + 1,
        };
        s.player = city;
        return { ok: true, city };
      });
    },

    async eraseOwnedRoads(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        if (input.tiles.length > 16) {
          return { ok: false, error: "Max 16 tiles per erase", city };
        }
        const erase = new Set(input.tiles.map((t) => tileKey(t.x, t.y)));
        city = {
          ...city,
          roads: city.roads.filter((r) => !erase.has(tileKey(r.x, r.y))),
          revision: city.revision + 1,
        };
        s.player = city;
        return { ok: true, city };
      });
    },

    async repositionEntity(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        const entity = city.entities.find((e) => e.id === input.entityId);
        if (!entity || entity.stored) return { ok: false, error: "Entity not found", city };
        if (entity.definitionId === "town_hall") {
          return { ok: false, error: "Cannot move town hall", city };
        }
        const place = validatePlacement(
          city,
          entity.definitionId,
          input.x,
          input.y,
          entity.id
        );
        if (!place.ok) return { ok: false, error: place.reason, city };
        city = {
          ...city,
          terrainOverrides: clearHarvestablesUnder(city, place.tiles),
          entities: city.entities.map((e) =>
            e.id === entity.id
              ? { ...e, x: input.x, y: input.y, revision: e.revision + 1 }
              : e
          ),
          revision: city.revision + 1,
        };
        s.player = city;
        return { ok: true, city };
      });
    },

    async storeEntity(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        const entity = city.entities.find((e) => e.id === input.entityId);
        if (!entity || entity.stored) return { ok: false, error: "Entity not found", city };
        if (entity.definitionId === "town_hall") {
          return { ok: false, error: "Cannot store town hall", city };
        }
        const proj = city.projects.find((p) => p.entityId === entity.id);
        if (proj && proj.workCurrent > 0) {
          return { ok: false, error: "Cannot store project with work", city };
        }
        city = {
          ...city,
          entities: city.entities.map((e) =>
            e.id === entity.id ? { ...e, stored: true } : e
          ),
          revision: city.revision + 1,
        };
        // Portal storage: reduce commerce if portal
        const portal = city.portals.find((p) => p.entityId === entity.id);
        if (portal) bumpCommerce(s, city.id, portal.destinationCityId, -1);
        city = refreshRates(s, city);
        s.player = city;
        return { ok: true, city };
      });
    },

    async restoreEntity(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        const entity = city.entities.find((e) => e.id === input.entityId);
        if (!entity || !entity.stored) return { ok: false, error: "Not in storage", city };
        const place = validatePlacement(city, entity.definitionId, input.x, input.y);
        if (!place.ok) return { ok: false, error: place.reason, city };
        city = {
          ...city,
          terrainOverrides: clearHarvestablesUnder(city, place.tiles),
          entities: city.entities.map((e) =>
            e.id === entity.id
              ? { ...e, stored: false, x: input.x, y: input.y }
              : e
          ),
          revision: city.revision + 1,
        };
        const portal = city.portals.find((p) => p.entityId === entity.id);
        if (portal) bumpCommerce(s, city.id, portal.destinationCityId, 1);
        city = refreshRates(s, city);
        s.player = city;
        return { ok: true, city };
      });
    },

    async createAssignedPortal(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        if (input.destinationCityId === city.id) {
          return { ok: false, error: "Cannot portal to yourself", city };
        }
        if (!findCity(s, input.destinationCityId)) {
          return { ok: false, error: "Destination not found", city };
        }
        if (!canSpendAction(city.economy)) {
          return { ok: false, error: "No actions remaining", city };
        }
        const place = validatePlacement(city, "portal", input.x, input.y);
        if (!place.ok) return { ok: false, error: place.reason, city };

        // Settle both cities before commerce change
        const dest = settleCity(findCity(s, input.destinationCityId)!, now()).city;
        setCity(s, dest);

        const entityId = uuid();
        city = {
          ...city,
          economy: spendAction(city.economy),
          terrainOverrides: clearHarvestablesUnder(city, place.tiles),
          entities: [
            ...city.entities,
            {
              id: entityId,
              definitionId: "portal",
              level: 1,
              x: input.x,
              y: input.y,
              rotation: 0,
              stored: false,
              revision: 1,
            },
          ],
          portals: [
            ...city.portals,
            {
              entityId,
              destinationCityId: input.destinationCityId,
              assignmentRevision: 1,
              enabled: true,
            },
          ],
          revision: city.revision + 1,
          activity: [
            {
              id: uuid(),
              at: now(),
              kind: "portal",
              message: `Portal opened to ${dest.name}.`,
            },
            ...city.activity,
          ].slice(0, 40),
        };
        bumpCommerce(s, city.id, input.destinationCityId, 1);
        city = refreshRates(s, city);
        setCity(s, refreshRates(s, dest));
        s.player = city;
        return { ok: true, city };
      });
    },

    async reassignPortal(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        const portal = city.portals.find((p) => p.entityId === input.portalEntityId);
        if (!portal) return { ok: false, error: "Portal not found", city };
        if (portal.assignmentRevision !== input.expectedAssignmentRevision) {
          return { ok: false, error: "Stale portal assignment", city };
        }
        if (portal.destinationCityId === input.destinationCityId) {
          return { ok: true, city }; // free no-op
        }
        if (input.destinationCityId === city.id) {
          return { ok: false, error: "Cannot portal to yourself", city };
        }
        if (!findCity(s, input.destinationCityId)) {
          return { ok: false, error: "Destination not found", city };
        }
        if (!canSpendAction(city.economy)) {
          return { ok: false, error: "No actions remaining", city };
        }

        const oldDest = settleCity(findCity(s, portal.destinationCityId)!, now()).city;
        const newDest = settleCity(findCity(s, input.destinationCityId)!, now()).city;
        setCity(s, oldDest);
        setCity(s, newDest);

        const entity = city.entities.find((e) => e.id === portal.entityId);
        const operational = entity && !entity.stored && portal.enabled;
        if (operational) {
          bumpCommerce(s, city.id, portal.destinationCityId, -1);
          bumpCommerce(s, city.id, input.destinationCityId, 1);
        }

        city = {
          ...city,
          economy: spendAction(city.economy),
          portals: city.portals.map((p) =>
            p.entityId === portal.entityId
              ? {
                  ...p,
                  destinationCityId: input.destinationCityId,
                  assignmentRevision: p.assignmentRevision + 1,
                }
              : p
          ),
          revision: city.revision + 1,
        };
        city = refreshRates(s, city);
        setCity(s, refreshRates(s, oldDest));
        setCity(s, refreshRates(s, newDest));
        s.player = city;
        return { ok: true, city };
      });
    },

    async sendResourceParcel(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        const portal = city.portals.find((p) => p.entityId === input.portalEntityId);
        if (!portal) return { ok: false, error: "Portal not found", city };
        if (portal.assignmentRevision !== input.expectedAssignmentRevision) {
          return { ok: false, error: "Stale portal assignment", city };
        }
        if (portal.destinationCityId !== input.destinationCityId) {
          return { ok: false, error: "Destination mismatch", city };
        }
        const entity = city.entities.find((e) => e.id === portal.entityId);
        if (!entity || entity.stored || !portal.enabled) {
          return { ok: false, error: "Portal unavailable", city };
        }
        const amounts = input.amounts;
        if (
          amounts.coins < 0 ||
          amounts.wood < 0 ||
          amounts.stone < 0 ||
          amounts.research < 0 ||
          amounts.happiness < 0 ||
          amounts.coins + amounts.wood + amounts.stone + amounts.research + amounts.happiness <= 0
        ) {
          return { ok: false, error: "Invalid parcel amounts", city };
        }
        if (!canSpendAction(city.economy)) {
          return { ok: false, error: "No actions remaining", city };
        }
        if (!canAfford(city.economy, amounts)) {
          return { ok: false, error: "Insufficient resources", city };
        }
        let dest = settleCity(findCity(s, input.destinationCityId)!, now()).city;
        if (!dest.delivery.inboundEnabled) {
          return { ok: false, error: "Destination disabled inbound", city };
        }
        if (dest.delivery.blockedSourceCityIds.includes(city.id)) {
          return { ok: false, error: "Blocked by destination", city };
        }

        city = {
          ...city,
          economy: spendAction(deduct(city.economy, amounts)),
          revision: city.revision + 1,
          activity: [
            {
              id: uuid(),
              at: now(),
              kind: "send",
              message: `Sent parcel to ${dest.name}.`,
            },
            ...city.activity,
          ].slice(0, 40),
        };
        dest = {
          ...dest,
          economy: credit(dest.economy, amounts),
          activity: [
            {
              id: uuid(),
              at: now(),
              kind: "receive",
              message: `Received parcel from ${city.name}.`,
            },
            ...dest.activity,
          ].slice(0, 40),
        };
        s.player = city;
        setCity(s, dest);
        return { ok: true, city };
      });
    },

    async sendProjectWork(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        const portal = city.portals.find((p) => p.entityId === input.portalEntityId);
        if (!portal) return { ok: false, error: "Portal not found", city };
        if (portal.assignmentRevision !== input.expectedAssignmentRevision) {
          return { ok: false, error: "Stale portal assignment", city };
        }
        if (portal.destinationCityId !== input.destinationCityId) {
          return { ok: false, error: "Destination mismatch", city };
        }
        const entity = city.entities.find((e) => e.id === portal.entityId);
        if (!entity || entity.stored || !portal.enabled) {
          return { ok: false, error: "Portal unavailable", city };
        }
        let dest = settleCity(findCity(s, input.destinationCityId)!, now()).city;
        if (!dest.delivery.inboundEnabled) {
          return { ok: false, error: "Destination disabled inbound", city };
        }
        const project = dest.projects.find((p) => p.id === input.projectId);
        if (!project || project.status === "complete") {
          return { ok: false, error: "Project unavailable", city };
        }
        const pdef = getProject(project.definitionId);
        const workCost: Resources = {
          coins: 0,
          wood: pdef.workCost.wood,
          stone: pdef.workCost.stone,
          research: pdef.workCost.research,
          happiness: 0,
        };
        if (!canAfford(city.economy, workCost)) {
          return {
            ok: false,
            error: `Need ${pdef.workCost.wood} wood, ${pdef.workCost.stone} stone${
              pdef.workCost.research ? `, ${pdef.workCost.research} research` : ""
            }`,
            city,
          };
        }

        const result = applyWork(project, 1, {
          cityId: city.id,
          cityName: city.name,
        });
        if (result.accepted === 0) {
          return { ok: false, error: "No work accepted", city: dest };
        }

        city = {
          ...city,
          economy: deduct(city.economy, workCost),
          revision: city.revision + 1,
        };

        let destProjects = dest.projects.map((p) =>
          p.id === project.id ? result.project : p
        );
        let destEntities = dest.entities;
        let destBlueprints = dest.blueprints;

        if (result.completed) {
          const pdef = getProject(project.definitionId);
          destEntities = destEntities.map((e) =>
            e.id === project.entityId
              ? {
                  ...e,
                  appearance: {
                    ...e.appearance,
                    stage: "complete",
                    projectType: project.definitionId,
                  },
                }
              : e
          );
          // Grant blueprints to all contributors + host
          const recipients = new Set([
            dest.id,
            ...result.project.contributors.map((c) => c.cityId),
          ]);
          for (const rid of recipients) {
            const c = findCity(s, rid);
            if (!c) continue;
            if (c.blueprints.some((b) => b.type === pdef.landmarkBlueprint)) continue;
            const updated = {
              ...c,
              blueprints: [
                ...c.blueprints,
                { type: pdef.landmarkBlueprint, provenance: project.id },
              ],
            };
            if (rid === dest.id) {
              destBlueprints = updated.blueprints;
            } else if (rid === city.id) {
              city = { ...city, blueprints: updated.blueprints };
            } else {
              setCity(s, updated);
            }
          }
        }

        dest = {
          ...dest,
          projects: destProjects,
          entities: destEntities,
          blueprints: destBlueprints,
          activity: [
            {
              id: uuid(),
              at: now(),
              kind: "work",
              message: `${city.name} contributed work.`,
            },
            ...dest.activity,
          ].slice(0, 40),
        };
        if (result.completed && project.definitionId === "space_center") {
          dest = registerSpaceCenter(dest, project.entityId);
        }
        s.player = city;
        setCity(s, dest);
        return { ok: true, city };
      });
    },

    async contributeToOwnProject(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        const project = city.projects.find((p) => p.id === input.projectId);
        if (!project || project.status === "complete") {
          return { ok: false, error: "Project unavailable", city };
        }
        const pdef = getProject(project.definitionId);
        const workCost: Resources = {
          coins: 0,
          wood: pdef.workCost.wood,
          stone: pdef.workCost.stone,
          research: pdef.workCost.research,
          happiness: 0,
        };
        if (!canAfford(city.economy, workCost)) {
          return {
            ok: false,
            error: `Need ${pdef.workCost.wood} wood, ${pdef.workCost.stone} stone${
              pdef.workCost.research ? `, ${pdef.workCost.research} research` : ""
            }`,
            city,
          };
        }
        const result = applyWork(project, 1, {
          cityId: city.id,
          cityName: city.name,
        });
        if (result.accepted === 0) {
          return { ok: false, error: "No work accepted", city };
        }

        city = {
          ...city,
          economy: deduct(city.economy, workCost),
          projects: city.projects.map((p) =>
            p.id === project.id ? result.project : p
          ),
          revision: city.revision + 1,
        };

        if (result.completed) {
          city = {
            ...city,
            entities: city.entities.map((e) =>
              e.id === project.entityId
                ? {
                    ...e,
                    appearance: {
                      ...e.appearance,
                      stage: "complete",
                      projectType: project.definitionId,
                    },
                  }
                : e
            ),
            blueprints: city.blueprints.some(
              (b) => b.type === pdef.landmarkBlueprint
            )
              ? city.blueprints
              : [
                  ...city.blueprints,
                  { type: pdef.landmarkBlueprint, provenance: project.id },
                ],
            activity: [
              {
                id: uuid(),
                at: now(),
                kind: "complete",
                message: `${pdef.name} is complete!`,
              },
              ...city.activity,
            ].slice(0, 40),
          };
          if (project.definitionId === "space_center") {
            city = registerSpaceCenter(city, project.entityId);
          }
          city = refreshRates(s, city);
        }
        s.player = city;
        return { ok: true, city };
      });
    },

    async takeSupplyRun(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        if (!canSpendAction(city.economy)) {
          return { ok: false, error: "No actions remaining", city };
        }
        const grant: Resources = { ...ZERO_RESOURCES };
        if (input.resource === "coins") grant.coins = 30;
        else if (input.resource === "wood") grant.wood = 20;
        else if (input.resource === "stone") grant.stone = 20;
        else if (input.resource === "research") grant.research = 20;
        else return { ok: false, error: "Unknown resource", city };
        city = {
          ...city,
          economy: spendAction(credit(city.economy, grant)),
          revision: city.revision + 1,
        };
        s.player = city;
        return { ok: true, city };
      });
    },

    async harvestTile(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        const result = tryHarvest(city, input.x, input.y, now());
        if (!result.ok) return { ok: false, error: result.error, city };
        s.player = result.city;
        return { ok: true, city: result.city };
      });
    },

    async bankExchange(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        const entity = city.entities.find((e) => e.id === input.entityId);
        if (!entity || !isBankEntity(entity)) {
          return { ok: false, error: "Select a finished bank", city };
        }
        const banks = countBanks(city);
        if (banks <= 0) {
          return { ok: false, error: "Finish a Bank project first", city };
        }
        const keys: ResourceKey[] = ["coins", "wood", "stone", "research"];
        if (!keys.includes(input.from as ResourceKey) || !keys.includes(input.to as ResourceKey)) {
          return { ok: false, error: "Invalid resources", city };
        }
        const quote = bankCostGain(input.from as ResourceKey, input.to as ResourceKey, banks);
        if (!quote) {
          return { ok: false, error: "That exchange is not offered", city };
        }
        if (!canSpendAction(city.economy)) {
          return { ok: false, error: "No actions remaining", city };
        }
        if (!canAfford(city.economy, quote.cost)) {
          return {
            ok: false,
            error: `Need ${quote.pay} ${input.from}`,
            city,
          };
        }
        city = {
          ...city,
          economy: spendAction(credit(deduct(city.economy, quote.cost), quote.gain)),
          revision: city.revision + 1,
          activity: [
            {
              id: uuid(),
              at: now(),
              kind: "bank",
              message: `Exchanged ${quote.pay} ${input.from} for ${quote.receive} ${input.to} (${banks} bank${banks === 1 ? "" : "s"}).`,
            },
            ...city.activity,
          ].slice(0, 40),
        };
        s.player = city;
        return { ok: true, city };
      });
    },

    async startHostedProject(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        if (!canSpendAction(city.economy)) {
          return { ok: false, error: "No actions remaining", city };
        }
        const pdef = tryGetProject(input.definitionId) ?? PROJECTS[input.definitionId];
        if (!pdef) {
          return {
            ok: false,
            error: `Unknown project: ${input.definitionId} (known: ${Object.keys(PROJECTS).join(", ")})`,
            city,
          };
        }
        const startCost: Resources = {
          coins: pdef.startCoins,
          wood: 0,
          stone: 0,
          research: pdef.startResearch,
          happiness: 0,
        };
        if (!canAfford(city.economy, startCost)) {
          const need = [`${pdef.startCoins} coins`];
          if (pdef.startResearch) need.push(`${pdef.startResearch} research`);
          return {
            ok: false,
            error: `Need ${need.join(" and ")} to start`,
            city,
          };
        }
        if (input.definitionId === "space_center") {
          const hasOperational = city.entities.some(isSpaceCenterEntity);
          const hasActiveSite = city.projects.some(
            (p) => p.definitionId === "space_center" && p.status !== "complete"
          );
          if (hasOperational || hasActiveSite) {
            return {
              ok: false,
              error: "Only one Space Center per city",
              city,
            };
          }
        }
        const place = validatePlacement(city, "project_site", input.x, input.y);
        if (!place.ok) return { ok: false, error: place.reason, city };
        const entityId = uuid();
        const projectId = uuid();
        city = {
          ...city,
          economy: spendAction(deduct(city.economy, startCost)),
          terrainOverrides: clearHarvestablesUnder(city, place.tiles),
          entities: [
            ...city.entities,
            {
              id: entityId,
              definitionId: "project_site",
              level: 1,
              x: input.x,
              y: input.y,
              rotation: 0,
              stored: false,
              appearance: { projectType: input.definitionId },
              revision: 1,
            },
          ],
          projects: [
            ...city.projects,
            {
              id: projectId,
              definitionId: input.definitionId,
              entityId,
              workCurrent: 0,
              status: "untouched",
              contributors: [],
            },
          ],
          revision: city.revision + 1,
          activity: [
            {
              id: uuid(),
              at: now(),
              kind: "project",
              message: `Started ${pdef.name} (${pdef.startCoins} coins${
                pdef.startResearch ? `, ${pdef.startResearch} research` : ""
              }).`,
            },
            ...city.activity,
          ].slice(0, 40),
        };
        city = syncClaimedRegions(city);
        s.player = city;
        return { ok: true, city };
      });
    },

    async cancelUntouchedProject(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        const project = city.projects.find((p) => p.id === input.projectId);
        if (!project || project.workCurrent > 0 || project.status === "complete") {
          return { ok: false, error: "Can only cancel untouched projects", city };
        }
        const pdef = getProject(project.definitionId);
        const refund: Resources = {
          coins: pdef.startCoins,
          wood: 0,
          stone: 0,
          research: pdef.startResearch,
          happiness: 0,
        };
        city = {
          ...city,
          economy: credit(city.economy, refund),
          projects: city.projects.filter((p) => p.id !== project.id),
          entities: city.entities.filter((e) => e.id !== project.entityId),
          revision: city.revision + 1,
        };
        s.player = city;
        return { ok: true, city };
      });
    },

    async placeLandmark(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        if (!city.blueprints.some((b) => b.type === input.definitionId)) {
          return { ok: false, error: "No blueprint entitlement", city };
        }
        const place = validatePlacement(city, input.definitionId, input.x, input.y);
        if (!place.ok) return { ok: false, error: place.reason, city };
        city = {
          ...city,
          terrainOverrides: clearHarvestablesUnder(city, place.tiles),
          entities: [
            ...city.entities,
            {
              id: uuid(),
              definitionId: input.definitionId,
              level: 1,
              x: input.x,
              y: input.y,
              rotation: 0,
              stored: false,
              revision: 1,
            },
          ],
          revision: city.revision + 1,
        };
        city = refreshRates(s, city);
        s.player = city;
        return { ok: true, city };
      });
    },

    async setInboundDeliveryPolicy(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        city = {
          ...city,
          delivery: { ...city.delivery, inboundEnabled: input.inboundEnabled },
          revision: city.revision + 1,
        };
        s.player = city;
        return { ok: true, city };
      });
    },

    async demoAdvanceHours(hours) {
      if (!enableDemoTools) {
        return { ok: false, error: "Demo tools unavailable" };
      }
      const s = ensure();
      if (!isDemoMapName(s.player.name)) {
        return { ok: false, error: "Demo tools require a city named demo", city: s.player };
      }
      s.clockOffsetMs += hours * 60 * 60 * 1000;
      save(s);
      const { city } = withSettledPlayer();
      return { ok: true, city };
    },

    async demoReset() {
      if (!enableDemoTools) {
        return { ok: false, error: "Demo tools unavailable" };
      }
      // Always allowed as a local recovery wipe; restores a city named "demo"
      // so demo tools remain available after reset from the demo panel.
      options.onHardReset?.();
      store = null;
      withSettledPlayer();
      const s = ensure();
      s.player = {
        ...s.player,
        name: "demo",
        displayName: "Demo",
        onboardingComplete: true,
      };
      save(s);
      return { ok: true, city: s.player };
    },

    async demoGrantResources(amount = 100) {
      if (!enableDemoTools) {
        return { ok: false, error: "Demo tools unavailable" };
      }
      const s = ensure();
      let city = settleCity(s.player, now()).city;
      if (!isDemoMapName(city.name)) {
        return { ok: false, error: "Demo tools require a city named demo", city };
      }
      const n = Math.max(0, Math.floor(amount));
      city = {
        ...city,
        economy: credit(city.economy, {
          coins: n,
          wood: n,
          stone: n,
          research: n,
          happiness: n,
        }),
        activity: [
          {
            id: uuid(),
            at: now(),
            kind: "demo",
            message: `Demo tool: +${n} to each resource.`,
          },
          ...city.activity,
        ].slice(0, 40),
      };
      s.player = city;
      save(s);
      return { ok: true, city };
    },

    async demoFillResources(amount = 99_999) {
      if (!enableDemoTools) {
        return { ok: false, error: "Demo tools unavailable" };
      }
      const s = ensure();
      let city = settleCity(s.player, now()).city;
      if (!isDemoMapName(city.name)) {
        return { ok: false, error: "Demo tools require a city named demo", city };
      }
      const n = Math.max(0, Math.floor(amount));
      city = {
        ...city,
        economy: {
          ...city.economy,
          coins: n,
          wood: n,
          stone: n,
          research: n,
          happiness: n,
        },
        activity: [
          {
            id: uuid(),
            at: now(),
            kind: "demo",
            message: `Demo tool: set each resource to ${n}.`,
          },
          ...city.activity,
        ].slice(0, 40),
      };
      s.player = city;
      save(s);
      return { ok: true, city };
    },

    async demoSimulatedContribution(projectId) {
      if (!enableDemoTools) {
        return { ok: false, error: "Demo tools unavailable" };
      }
      const s = ensure();
      let city = settleCity(s.player, now()).city;
      if (!isDemoMapName(city.name)) {
        return { ok: false, error: "Demo tools require a city named demo", city };
      }
      const project = city.projects.find((p) => p.id === projectId);
      if (!project || project.status === "complete") {
        return { ok: false, error: "Project unavailable", city };
      }
      const neighbor = s.neighbors[0];
      const result = applyWork(project, 1, {
        cityId: neighbor.id,
        cityName: neighbor.name + " (simulated)",
      });
      city = {
        ...city,
        projects: city.projects.map((p) =>
          p.id === projectId ? result.project : p
        ),
        activity: [
          {
            id: uuid(),
            at: now(),
            kind: "sim_work",
            message: `Demo tool: ${neighbor.name} contributed (simulated).`,
          },
          ...city.activity,
        ].slice(0, 40),
      };
      if (result.completed) {
        const pdef = getProject(project.definitionId);
        if (!city.blueprints.some((b) => b.type === pdef.landmarkBlueprint)) {
          city = {
            ...city,
            blueprints: [
              ...city.blueprints,
              { type: pdef.landmarkBlueprint, provenance: project.id },
            ],
          };
        }
      }
      s.player = city;
      save(s);
      return { ok: true, city };
    },

    async designatePrimaryHome(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        const result = cmdDesignateHome(city, input.houseEntityId);
        if (!result.ok) return result;
        s.player = refreshRates(s, result.city);
        return { ok: true, city: s.player };
      });
    },

    async setHomePrivacy(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        const result = cmdSetHomePrivacy(city, input.privacy);
        if (!result.ok) return result;
        s.player = result.city;
        return { ok: true, city: s.player };
      });
    },

    async acquireFurnitureBundle(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        const result = cmdAcquireBundle(
          city,
          input.bundleId as FurnitureBundleId,
          now()
        );
        if (!result.ok) return result;
        s.player = result.city;
        return { ok: true, city: s.player };
      });
    },

    async addInteriorRoom(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        const result = cmdAddInteriorRoom(city, input.interiorSceneId, now());
        if (!result.ok) return result;
        s.player = result.city;
        return { ok: true, city: s.player };
      });
    },

    async placeHomeItem(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        const result = cmdPlaceHomeItem(city, input);
        if (!result.ok) return result;
        s.player = refreshRates(s, result.city);
        return { ok: true, city: s.player };
      });
    },

    async moveHomeItem(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        const result = cmdMoveHomeItem(city, input);
        if (!result.ok) return result;
        s.player = refreshRates(s, result.city);
        return { ok: true, city: s.player };
      });
    },

    async storeHomeItem(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        const result = cmdStoreHomeItem(city, input);
        if (!result.ok) return result;
        s.player = refreshRates(s, result.city);
        return { ok: true, city: s.player };
      });
    },

    async buildGardenBed(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        const result = cmdBuildGardenBed(
          city,
          input.backyardSceneId,
          input.x,
          input.y,
          now()
        );
        if (!result.ok) return result;
        s.player = refreshRates(s, result.city);
        return { ok: true, city: s.player };
      });
    },

    async plantGardenBatch(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        const result = cmdPlantBatch(
          city,
          {
            backyardSceneId: input.backyardSceneId,
            bedItemId: input.bedItemId,
            changes: input.changes as {
              slotIndex: number;
              varietyId: PlantVarietyId | null;
            }[],
          },
          now()
        );
        if (!result.ok) return result;
        s.player = refreshRates(s, result.city);
        return { ok: true, city: s.player };
      });
    },

    async foundingLaunch(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        const result = cmdFoundingLaunch(
          city,
          input.spaceCenterEntityId,
          input.launchId,
          now()
        );
        if (!result.ok) return result;
        s.player = result.city;
        return { ok: true, city: s.player, data: result.data };
      });
    },

    async launchStationModule(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        const result = cmdLaunchModule(
          city,
          {
            stationId: input.stationId,
            definitionId: input.definitionId as StationModuleDefId,
            gx: input.gx,
            gy: input.gy,
            rotation: input.rotation,
            launchId: input.launchId,
          },
          now()
        );
        if (!result.ok) return result;
        s.player = result.city;
        return { ok: true, city: s.player, data: result.data };
      });
    },

    async launchInstrument(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        const result = cmdLaunchInstrument(
          city,
          {
            stationId: input.stationId,
            moduleId: input.moduleId,
            instrumentId: input.instrumentId as InstrumentDefId,
            launchId: input.launchId,
          },
          now()
        );
        if (!result.ok) return result;
        s.player = result.city;
        return { ok: true, city: s.player };
      });
    },

    async storeStationModule(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        const result = cmdStoreStationModule(city, input.stationId, input.moduleId);
        if (!result.ok) return result;
        s.player = result.city;
        return { ok: true, city: s.player };
      });
    },

    async restoreStationModule(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        const result = cmdRestoreStationModule(city, input);
        if (!result.ok) return result;
        s.player = result.city;
        return { ok: true, city: s.player };
      });
    },

    async listExpeditionRegions() {
      const s = ensure();
      const city = settleCity(s.player, now()).city;
      s.player = syncClaimedRegions(city);
      save(s);
      return {
        ok: true,
        city: s.player,
        data: { regions: listExplorationRegions(s.player) },
      };
    },

    async previewExpeditionChoices(input) {
      const s = ensure();
      const city = settleCity(s.player, now()).city;
      return {
        ok: true,
        city,
        data: { choices: listFirstChoices(city, input.regionKey) },
      };
    },

    async dispatchExpedition(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        const result = cmdDispatchExpedition(
          city,
          input.regionKey,
          input.firstChoiceId,
          now()
        );
        if (!result.ok) return result;
        s.player = refreshRates(s, result.city);
        return { ok: true, city: s.player, data: result.data };
      });
    },

    async expeditionStep(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        const result = cmdExpeditionStep(city, input.choiceId, now());
        if (!result.ok) return result;
        s.player = refreshRates(s, result.city);
        return { ok: true, city: s.player, data: result.data };
      });
    },

    async recallExpedition(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        const result = cmdRecallExpedition(city);
        if (!result.ok) return result;
        s.player = result.city;
        return { ok: true, city: s.player };
      });
    },

    async abandonExpedition(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        const result = cmdAbandonExpedition(city);
        if (!result.ok) return result;
        s.player = result.city;
        return { ok: true, city: s.player };
      });
    },

    async sendPortableItem(input) {
      return idempotent(input.requestId, () => {
        const s = ensure();
        let city = settleCity(s.player, now()).city;
        if (city.revision !== input.expectedRevision) {
          return { ok: false, error: "Stale city revision", city };
        }
        const portal = city.portals.find((p) => p.entityId === input.portalEntityId);
        if (!portal || !portal.enabled) {
          return { ok: false, error: "Portal unavailable", city };
        }
        if (portal.assignmentRevision !== input.expectedAssignmentRevision) {
          return { ok: false, error: "Stale portal assignment", city };
        }
        if (portal.destinationCityId !== input.destinationCityId) {
          return { ok: false, error: "Destination mismatch", city };
        }
        const dest = findCity(s, input.destinationCityId);
        if (!dest) return { ok: false, error: "Destination city missing", city };
        if (!dest.delivery.inboundEnabled) {
          return { ok: false, error: "Destination blocks inbound gifts", city };
        }
        const result = cmdSendPortableItem(city, dest, {
          inventoryItemId: input.inventoryItemId,
          quantity: input.quantity,
        });
        if (!result.ok) return result;
        s.player = result.city;
        if (result.dest) setCity(s, result.dest);
        return { ok: true, city: s.player };
      });
    },
  };

  return service;
}
