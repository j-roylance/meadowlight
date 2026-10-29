import {
  GRANT_SPACE_FLOWER_SEED,
  INSTRUMENTS,
  STATION_MODULES,
  getInstrument,
  getStationModule,
  type InstrumentDefId,
  type StationModuleDefId,
} from "@/game/catalog/expansion";
import type {
  CityState,
  ExpansionState,
  SpaceCenterState,
  StationModule,
  StationState,
} from "@/game/types";
import { v4 as uuid } from "uuid";

type Port = "n" | "e" | "s" | "w";

const OPPOSITE: Record<Port, Port> = { n: "s", e: "w", s: "n", w: "e" };
const DELTA: Record<Port, { dx: number; dy: number }> = {
  n: { dx: 0, dy: -1 },
  e: { dx: 1, dy: 0 },
  s: { dx: 0, dy: 1 },
  w: { dx: -1, dy: 0 },
};

function rotatePort(port: Port, rotation: 0 | 90 | 180 | 270): Port {
  const order: Port[] = ["n", "e", "s", "w"];
  const idx = order.indexOf(port);
  const steps = rotation / 90;
  return order[(idx + steps) % 4];
}

export function modulePorts(
  defId: StationModuleDefId | "core",
  rotation: 0 | 90 | 180 | 270
): Port[] {
  if (defId === "core") return ["n", "e", "s", "w"];
  const def = STATION_MODULES[defId];
  return def.ports.map((p) => rotatePort(p, rotation));
}

export function createStationCore(
  cityId: string,
  spaceCenterEntityId: string
): StationState {
  const coreId = uuid();
  const core: StationModule = {
    id: coreId,
    definitionId: "core",
    gx: 0,
    gy: 0,
    rotation: 0,
    stored: false,
    items: [],
    instruments: [],
  };
  return {
    id: uuid(),
    cityId,
    spaceCenterEntityId,
    coreModuleId: coreId,
    modules: [core],
    journal: [],
    revision: 1,
  };
}

export function stationPower(station: StationState): { provided: number; used: number } {
  let provided = 2; // core
  let used = 0;
  for (const mod of station.modules) {
    if (mod.stored) continue;
    if (mod.definitionId !== "core") {
      const def = getStationModule(mod.definitionId);
      if (def) provided += def.powerProvided;
    }
    for (const inst of mod.instruments) {
      if (!inst.operational) continue;
      const idef = getInstrument(inst.definitionId);
      if (idef) used += idef.powerCost;
    }
  }
  return { provided, used };
}

export function placedModules(station: StationState): StationModule[] {
  return station.modules.filter((m) => !m.stored);
}

function occupancyKey(gx: number, gy: number): string {
  return `${gx},${gy}`;
}

export function validateModuleAttachment(
  station: StationState,
  defId: StationModuleDefId,
  gx: number,
  gy: number,
  rotation: 0 | 90 | 180 | 270,
  ignoreModuleId?: string
): { ok: true } | { ok: false; error: string } {
  const occupied = new Set(
    placedModules(station)
      .filter((m) => m.id !== ignoreModuleId)
      .map((m) => occupancyKey(m.gx, m.gy))
  );
  if (occupied.has(occupancyKey(gx, gy))) {
    return { ok: false, error: "Cell occupied" };
  }
  const newPorts = modulePorts(defId, rotation);
  let connected = false;
  for (const port of newPorts) {
    const d = DELTA[port];
    const nx = gx + d.dx;
    const ny = gy + d.dy;
    const neighbor = placedModules(station).find(
      (m) => m.gx === nx && m.gy === ny && m.id !== ignoreModuleId
    );
    if (!neighbor) continue;
    const nPorts = modulePorts(neighbor.definitionId, neighbor.rotation);
    if (nPorts.includes(OPPOSITE[port])) {
      connected = true;
      break;
    }
  }
  if (!connected) return { ok: false, error: "Must connect through compatible ports" };
  // Connectivity to core after placement.
  const trial: StationModule = {
    id: "trial",
    definitionId: defId,
    gx,
    gy,
    rotation,
    stored: false,
    items: [],
    instruments: [],
  };
  const mods = [
    ...placedModules(station).filter((m) => m.id !== ignoreModuleId),
    trial,
  ];
  if (!isConnectedToCore(mods, station.coreModuleId)) {
    return { ok: false, error: "Station would disconnect from core" };
  }
  return { ok: true };
}

export function isConnectedToCore(modules: StationModule[], coreModuleId: string): boolean {
  const byPos = new Map(modules.map((m) => [occupancyKey(m.gx, m.gy), m]));
  const core = modules.find((m) => m.id === coreModuleId);
  if (!core) return false;
  const seen = new Set<string>();
  const queue = [occupancyKey(core.gx, core.gy)];
  while (queue.length) {
    const key = queue.pop()!;
    if (seen.has(key)) continue;
    seen.add(key);
    const mod = byPos.get(key);
    if (!mod) continue;
    for (const port of modulePorts(mod.definitionId, mod.rotation)) {
      const d = DELTA[port];
      const nk = occupancyKey(mod.gx + d.dx, mod.gy + d.dy);
      const neighbor = byPos.get(nk);
      if (!neighbor || seen.has(nk)) continue;
      const nPorts = modulePorts(neighbor.definitionId, neighbor.rotation);
      if (nPorts.includes(OPPOSITE[port])) queue.push(nk);
    }
  }
  return modules.every((m) => seen.has(occupancyKey(m.gx, m.gy)));
}

export function canStoreModule(
  station: StationState,
  moduleId: string
): { ok: true } | { ok: false; error: string } {
  const mod = station.modules.find((m) => m.id === moduleId);
  if (!mod) return { ok: false, error: "Module not found" };
  if (mod.definitionId === "core") return { ok: false, error: "Core cannot be stored" };
  if (mod.instruments.some((i) => i.operational)) {
    return { ok: false, error: "Store instruments first" };
  }
  if (mod.items.length > 0) {
    return { ok: false, error: "Clear room furnishings first" };
  }
  const remaining = placedModules(station).filter((m) => m.id !== moduleId);
  if (!isConnectedToCore(remaining, station.coreModuleId)) {
    return { ok: false, error: "Would disconnect the station" };
  }
  const trial: StationState = {
    ...station,
    modules: station.modules.map((m) =>
      m.id === moduleId ? { ...m, stored: true } : m
    ),
  };
  const power = stationPower(trial);
  if (power.used > power.provided) {
    return { ok: false, error: "Would leave instruments without power" };
  }
  return { ok: true };
}

export function installInstrument(
  station: StationState,
  moduleId: string,
  instrumentId: InstrumentDefId
): { ok: true; station: StationState; unlockSpaceFlower: boolean } | { ok: false; error: string } {
  const mod = station.modules.find((m) => m.id === moduleId && !m.stored);
  if (!mod || mod.definitionId === "core") {
    return { ok: false, error: "Choose an eligible module" };
  }
  const idef = getInstrument(instrumentId);
  if (!idef) return { ok: false, error: "Unknown instrument" };
  if (!idef.fitsModules.includes(mod.definitionId as StationModuleDefId)) {
    return { ok: false, error: "Instrument does not fit this module" };
  }
  if (mod.instruments.some((i) => i.operational)) {
    return { ok: false, error: "Module instrument slot occupied" };
  }
  const power = stationPower(station);
  if (power.used + idef.powerCost > power.provided) {
    return { ok: false, error: "Insufficient station power" };
  }
  const unlockSpaceFlower = instrumentId === "plant_growth_chamber";
  const next: StationState = {
    ...station,
    modules: station.modules.map((m) =>
      m.id === moduleId
        ? {
            ...m,
            instruments: [
              ...m.instruments,
              {
                id: uuid(),
                definitionId: instrumentId,
                moduleId,
                slotIndex: 0,
                operational: true,
              },
            ],
          }
        : m
    ),
    revision: station.revision + 1,
  };
  return { ok: true, station: next, unlockSpaceFlower };
}

export function hasOperationalInstrument(
  expansion: ExpansionState,
  instrumentId: InstrumentDefId
): boolean {
  for (const station of Object.values(expansion.stations)) {
    for (const mod of station.modules) {
      if (mod.stored) continue;
      if (mod.instruments.some((i) => i.definitionId === instrumentId && i.operational)) {
        return true;
      }
    }
  }
  return false;
}

export function applySpaceFlowerUnlock(expansion: ExpansionState): ExpansionState {
  if (expansion.grants[GRANT_SPACE_FLOWER_SEED]) return expansion;
  return {
    ...expansion,
    grants: { ...expansion.grants, [GRANT_SPACE_FLOWER_SEED]: true },
    seedUnlocks: expansion.seedUnlocks.includes("space_flower")
      ? expansion.seedUnlocks
      : [...expansion.seedUnlocks, "space_flower"],
  };
}

export function registerSpaceCenter(
  city: CityState,
  entityId: string
): CityState {
  const existing = city.expansion.spaceCenters.find((s) => s.entityId === entityId);
  if (existing) return city;
  const entry: SpaceCenterState = {
    entityId,
    stationId: null,
    founded: false,
  };
  return {
    ...city,
    expansion: {
      ...city.expansion,
      spaceCenters: [...city.expansion.spaceCenters, entry],
    },
  };
}

export function astronomyEntryForLaunch(launchId: string, at: number): {
  id: string;
  launchId: string;
  text: string;
  at: number;
} {
  return {
    id: uuid(),
    launchId,
    text: `Sighted a calm starfield during launch ${launchId.slice(0, 8)}.`,
    at,
  };
}
