import { createStarterCity } from "@/game/simulation/starter";
import type { GameService } from "./types";
import {
  createWorldService,
  makeNeighbors,
  migrateCity,
  type WorldStore,
} from "@/game/engine/worldService";
import { bigintReplacer, reviveBigints } from "@/game/engine/serialize";
import { HOUSE_STYLES } from "@/game/catalog/definitions";

/** v8: expansion (home/garden/space/exploration). Migrates from v7 without wiping economy. */
const STORAGE_KEY = "meadowlight.local_demo.v8";
const LEGACY_STORAGE_KEYS = [
  "meadowlight.local_demo.v7",
  "meadowlight.local_demo.v5",
  "meadowlight.local_demo.v4",
  "meadowlight.local_demo.v3",
  "meadowlight.local_demo.v2",
];

function loadStore(): WorldStore | null {
  if (typeof window === "undefined") return null;
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    let fromLegacy = false;
    if (!raw) {
      for (const key of LEGACY_STORAGE_KEYS) {
        raw = localStorage.getItem(key);
        if (raw) {
          fromLegacy = true;
          break;
        }
      }
    }
    if (!raw) return null;
    const store = reviveBigints<WorldStore>(JSON.parse(raw));
    store.player = migrateCity(store.player);
    store.neighbors = store.neighbors.map(migrateCity);
    if (fromLegacy) {
      saveStore(store);
      for (const key of LEGACY_STORAGE_KEYS) localStorage.removeItem(key);
    }
    return store;
  } catch {
    return null;
  }
}

function saveStore(store: WorldStore) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store, bigintReplacer));
}

function createInitialStore(now: number): WorldStore {
  const player = createStarterCity({
    id: "local-player",
    ownerId: "local-owner",
    name: "Meadowlight",
    displayName: "You",
    specialty: "markets",
    now,
    seed: 1,
  });
  return {
    player,
    neighbors: makeNeighbors(now),
    clockOffsetMs: 0,
    receipts: {},
    commerce: [],
  };
}

export function createLocalDemoService(): GameService {
  return createWorldService({
    mode: "local_demo",
    modeLabel: "Meadowlight",
    persistence: { load: loadStore, save: saveStore },
    createInitialStore,
    directoryMode: "demo_gated",
    enableDemoTools: true,
    onHardReset: () => {
      if (typeof window === "undefined") return;
      localStorage.removeItem(STORAGE_KEY);
      for (const key of LEGACY_STORAGE_KEYS) localStorage.removeItem(key);
    },
  });
}

export { HOUSE_STYLES };
