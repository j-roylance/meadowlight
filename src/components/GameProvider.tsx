"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { v4 as uuid } from "uuid";
import { createGameService, type GameService } from "@/game/adapters";
import { getBuilding } from "@/game/catalog/definitions";
import { validatePlacement } from "@/game/simulation/placement";
import { validateRoadPath, roadSet } from "@/game/simulation/roads";
import { validateRoadTile } from "@/game/simulation/placement";
import { isHarvestable, resolveTerrain } from "@/game/simulation/terrain";
import { msUntilNextWindow, formatDuration } from "@/game/simulation/actions";
import { CATALOG_VERSION, HARVEST_STONE, HARVEST_WOOD } from "@/game/types";
import type {
  ActiveSceneView,
  BuildingDefId,
  CityState,
  CommandResult,
  DirectoryEntry,
  ExpeditionChoice,
  ExpeditionRegion,
  PlacedEntity,
  ProjectDefId,
  Specialty,
  ToolMode,
  WorldCoord,
} from "@/game/types";
import {
  EXPANSION_CATALOG_VERSION,
  type FurnitureBundleId,
  type InstrumentDefId,
  type PlantVarietyId,
  type StationModuleDefId,
} from "@/game/catalog/expansion";
import { isDemoMapName } from "@/game/demoMap";
import { isSupabaseEnvReady } from "@/lib/supabase/env";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { useAuthSession } from "./auth/AuthGate";
import { ResourceAmount } from "./ResourceIcon";

const SERVICE_GEN = `${CATALOG_VERSION}:${EXPANSION_CATALOG_VERSION}`;

type Rotation = 0 | 90 | 180 | 270;

/** Short-lived launch animation request (skipped entirely under reduced motion). */
export interface LaunchFx {
  id: string;
  label: string;
}

interface GameContextValue {
  service: GameService;
  isMultiplayer: boolean;
  accountEmail: string | null;
  signOut: () => Promise<void>;
  city: CityState | null;
  loading: boolean;
  error: string | null;
  tool: ToolMode;
  setTool: (t: ToolMode) => void;
  buildDefId: BuildingDefId | null;
  setBuildDefId: (id: BuildingDefId | null) => void;
  selected: PlacedEntity | null;
  setSelected: (e: PlacedEntity | null) => void;
  roadDraft: WorldCoord[];
  setRoadDraft: (t: WorldCoord[]) => void;
  panel: "city" | "maps" | "projects" | "settings" | "build" | "send" | "demo";
  setPanel: (p: GameContextValue["panel"]) => void;
  visiting: CityState | null;
  directory: DirectoryEntry[];
  ghost: { valid: boolean; reason?: ReactNode };
  nextWindowLabel: string;
  refresh: () => Promise<void>;
  handleTileClick: (x: bigint, y: bigint) => Promise<void>;
  handleTileHover: (x: bigint, y: bigint) => void;
  handleEntityClick: (e: PlacedEntity) => void;
  completeOnboarding: (name: string, specialty: Specialty) => Promise<void>;
  renameCity: (name: string) => Promise<void>;
  openMaps: () => Promise<void>;
  visitCity: (cityId: string) => Promise<void>;
  returnHome: () => Promise<void>;
  isDemoMap: boolean;
  contributeOwn: (projectId: string) => Promise<void>;
  pendingProjectId: ProjectDefId | null;
  beginProjectPlacement: (definitionId: ProjectDefId) => void;
  cancelUntouched: (projectId: string) => Promise<void>;
  supplyRun: (resource: "coins" | "wood" | "stone" | "research") => Promise<void>;
  upgradeSelected: () => Promise<void>;
  storeSelected: () => Promise<void>;
  bankExchange: (
    from: "coins" | "wood" | "stone" | "research",
    to: "coins" | "wood" | "stone" | "research"
  ) => Promise<void>;
  confirmRoad: () => Promise<void>;
  portalDestinationId: string | null;
  setPortalDestinationId: (id: string | null) => void;
  createPortalAt: (x: bigint, y: bigint) => Promise<void>;
  sendParcel: (amounts: {
    coins: number;
    wood: number;
    stone: number;
    research: number;
    happiness: number;
  }) => Promise<void>;
  sendWork: (projectId: string) => Promise<void>;
  sendPortableGift: (inventoryItemId: string, quantity?: number) => Promise<void>;
  demoAdvance: (hours: number) => Promise<void>;
  demoReset: () => Promise<void>;
  demoSimWork: (projectId: string) => Promise<void>;
  demoGrantResources: (amount?: number) => Promise<void>;
  demoFillResources: (amount?: number) => Promise<void>;
  reducedMotion: boolean;
  setReducedMotion: (v: boolean) => void;

  // --- Expansion scenes ---
  sceneView: ActiveSceneView;
  setSceneView: (v: ActiveSceneView) => void;
  enterHome: (houseEntityId?: string) => void;
  enterBackyard: (houseEntityId?: string) => void;
  enterStation: (spaceCenterEntityId?: string) => void;
  enterExpedition: (expeditionId?: string) => void;
  returnToCity: () => void;
  launchFx: LaunchFx | null;
  clearLaunchFx: () => void;

  designateHome: (houseEntityId: string) => Promise<CommandResult>;
  acquireBundle: (bundleId: FurnitureBundleId) => Promise<CommandResult>;
  addRoom: (interiorSceneId: string) => Promise<CommandResult>;
  placeHomeItem: (input: {
    sceneKind: "interior" | "backyard";
    sceneId: string;
    inventoryItemId: string;
    x: number;
    y: number;
    rotation: Rotation;
    roomId: string;
  }) => Promise<CommandResult>;
  moveHomeItem: (input: {
    sceneKind: "interior" | "backyard";
    sceneId: string;
    itemId: string;
    x: number;
    y: number;
    rotation: Rotation;
    roomId: string;
  }) => Promise<CommandResult>;
  storeHomeItem: (input: {
    sceneKind: "interior" | "backyard";
    sceneId: string;
    itemId: string;
  }) => Promise<CommandResult>;
  buildGardenBed: (backyardSceneId: string, x: number, y: number) => Promise<CommandResult>;
  plantBatch: (
    backyardSceneId: string,
    bedItemId: string,
    changes: { slotIndex: number; varietyId: PlantVarietyId | null }[]
  ) => Promise<CommandResult>;
  foundingLaunch: (spaceCenterEntityId: string) => Promise<CommandResult>;
  launchModule: (input: {
    stationId: string;
    definitionId: StationModuleDefId;
    gx: number;
    gy: number;
    rotation: Rotation;
  }) => Promise<CommandResult>;
  launchInstrument: (input: {
    stationId: string;
    moduleId: string;
    instrumentId: InstrumentDefId;
  }) => Promise<CommandResult>;
  storeStationModule: (stationId: string, moduleId: string) => Promise<CommandResult>;
  restoreStationModule: (input: {
    stationId: string;
    moduleId: string;
    gx: number;
    gy: number;
    rotation: Rotation;
  }) => Promise<CommandResult>;
  listRegions: () => Promise<ExpeditionRegion[]>;
  previewChoices: (regionKey: string) => Promise<ExpeditionChoice[]>;
  dispatchExpedition: (regionKey: string, firstChoiceId: string) => Promise<CommandResult>;
  expeditionStep: (choiceId: string) => Promise<CommandResult>;
  recallExpedition: () => Promise<CommandResult>;
  abandonExpedition: () => Promise<CommandResult>;
}

const GameContext = createContext<GameContextValue | null>(null);

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame outside provider");
  return ctx;
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { session, mode } = useAuthSession();
  const isMultiplayer = mode === "signed_in" && isSupabaseEnvReady();
  const serviceKey = `${SERVICE_GEN}:${isMultiplayer ? "mp" : "demo"}:${session?.user.id ?? "anon"}`;

  // Recreate when catalog gen or auth mode changes.
  const serviceRef = useRef<{ key: string; service: GameService } | null>(null);
  if (!serviceRef.current || serviceRef.current.key !== serviceKey) {
    serviceRef.current = {
      key: serviceKey,
      service: createGameService({ mode: isMultiplayer ? "multiplayer" : "local_demo" }),
    };
  }
  const service = serviceRef.current.service;
  const [city, setCity] = useState<CityState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolMode>("inspect");
  const [buildDefId, setBuildDefId] = useState<BuildingDefId | null>(null);
  const [selected, setSelected] = useState<PlacedEntity | null>(null);
  const [roadDraft, setRoadDraft] = useState<WorldCoord[]>([]);
  const [panel, setPanel] = useState<GameContextValue["panel"]>("city");
  const [visiting, setVisiting] = useState<CityState | null>(null);
  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);
  const [ghost, setGhost] = useState<{ valid: boolean; reason?: ReactNode }>({
    valid: true,
  });
  const [portalDestinationId, setPortalDestinationId] = useState<string | null>(null);
  const [pendingProjectId, setPendingProjectId] = useState<ProjectDefId | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [sceneView, setSceneView] = useState<ActiveSceneView>({ kind: "city" });
  const [launchFx, setLaunchFx] = useState<LaunchFx | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await service.syncMyCity();
    if (res.ok && res.city) setCity(res.city);
    else setError(res.error ?? "Sync failed");
    setLoading(false);
  }, [service]);

  useEffect(() => {
    setCity(null);
    setVisiting(null);
    void refresh();
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const signOut = useCallback(async () => {
    if (!isSupabaseEnvReady()) return;
    const sb = createBrowserSupabase();
    await sb.auth.signOut();
    setCity(null);
    setVisiting(null);
    setPanel("city");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const fn = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  const applyCity = (res: { ok: boolean; error?: string; city?: CityState }) => {
    if (res.ok && res.city) {
      setCity(res.city);
      setError(null);
    } else {
      setError(res.error ?? "Action failed");
    }
  };

  const handleTileHover = useCallback(
    (x: bigint, y: bigint) => {
      if (!city || visiting) return;
      if (tool === "build" && buildDefId) {
        const v = validatePlacement(city, buildDefId, x, y);
        setGhost({ valid: v.ok, reason: v.reason });
      } else if (tool === "portal") {
        const v = validatePlacement(city, "portal", x, y);
        const dest = portalDestinationId
          ? undefined
          : "Choose a destination city first";
        setGhost({
          valid: v.ok && Boolean(portalDestinationId),
          reason: dest ?? v.reason,
        });
      } else if (tool === "project") {
        const v = validatePlacement(city, "project_site", x, y);
        setGhost({
          valid: v.ok && Boolean(pendingProjectId),
          reason: pendingProjectId ? v.reason : "Choose a project type first",
        });
      } else if (tool === "road") {
        const v = validateRoadTile(city, x, y);
        setGhost({ valid: v.ok, reason: v.reason });
      } else if (tool === "inspect") {
        const kind = resolveTerrain(city, x, y);
        if (kind === "tree") {
          setGhost({
            valid: city.economy.actionsRemaining > 0,
            reason: (
              <span className="inline-flex items-center gap-1.5">
                Harvest tree · 1 action · +
                <ResourceAmount resource="wood" amount={HARVEST_WOOD} size="sm" />
              </span>
            ),
          });
        } else if (kind === "stone_pile") {
          setGhost({
            valid: city.economy.actionsRemaining > 0,
            reason: (
              <span className="inline-flex items-center gap-1.5">
                Harvest stone · 1 action · +
                <ResourceAmount resource="stone" amount={HARVEST_STONE} size="sm" />
              </span>
            ),
          });
        } else {
          setGhost({ valid: true });
        }
      }
    },
    [city, visiting, tool, buildDefId, portalDestinationId, pendingProjectId]
  );

  const handleTileClick = useCallback(
    async (x: bigint, y: bigint) => {
      if (!city || visiting) return;
      if (tool === "build" && buildDefId) {
        const res = await service.placeBuilding({
          requestId: uuid(),
          expectedRevision: city.revision,
          definitionId: buildDefId,
          x,
          y,
        });
        applyCity(res);
        return;
      }
      if (tool === "portal" && portalDestinationId) {
        await createPortalAt(x, y);
        return;
      }
      if (tool === "project" && pendingProjectId) {
        const res = await service.startHostedProject({
          requestId: uuid(),
          expectedRevision: city.revision,
          definitionId: pendingProjectId,
          x,
          y,
        });
        applyCity(res);
        // Keep project placement armed so you can start as many sites as you want.
        if (res.ok) {
          setPanel("city");
        }
        return;
      }
      if (tool === "road") {
        setRoadDraft((prev) => {
          if (prev.length === 0) return [{ x, y }];
          const last = prev[prev.length - 1];
          const adx = x > last.x ? x - last.x : last.x - x;
          const ady = y > last.y ? y - last.y : last.y - y;
          if (!((adx === 1n && ady === 0n) || (adx === 0n && ady === 1n))) {
            return [{ x, y }];
          }
          if (prev.length >= 16) return prev;
          return [...prev, { x, y }];
        });
        return;
      }
      if (tool === "erase_road") {
        const res = await service.eraseOwnedRoads({
          requestId: uuid(),
          expectedRevision: city.revision,
          tiles: [{ x, y }],
        });
        applyCity(res);
        return;
      }
      // Inspect / default: harvest trees and stone piles (1 action).
      if (tool === "inspect" || tool === "store") {
        const kind = resolveTerrain(city, x, y);
        if (isHarvestable(kind)) {
          const res = await service.harvestTile({
            requestId: uuid(),
            expectedRevision: city.revision,
            x,
            y,
          });
          applyCity(res);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [city, visiting, tool, buildDefId, portalDestinationId, pendingProjectId, service]
  );

  const createPortalAt = async (x: bigint, y: bigint) => {
    if (!city || !portalDestinationId) return;
    const res = await service.createAssignedPortal({
      requestId: uuid(),
      expectedRevision: city.revision,
      x,
      y,
      destinationCityId: portalDestinationId,
    });
    applyCity(res);
    if (res.ok) {
      setTool("inspect");
      setPortalDestinationId(null);
    }
  };

  const handleEntityClick = (e: PlacedEntity) => {
    setSelected(e);
    if (tool === "store" && city) {
      void (async () => {
        const res = await service.storeEntity({
          requestId: uuid(),
          expectedRevision: city.revision,
          entityId: e.id,
        });
        applyCity(res);
        setSelected(null);
      })();
      return;
    }
    // Leave placement mode so Inspect → Contribute works (no action cost).
    if (tool === "build" || tool === "portal" || tool === "project") {
      setTool("inspect");
      setBuildDefId(null);
      setPendingProjectId(null);
    }
  };

  const confirmRoad = async () => {
    if (!city || roadDraft.length === 0) return;
    const existing = roadSet(city.roads);
    const check = validateRoadPath(roadDraft, existing);
    if (!check.ok) {
      setError(check.error ?? "Invalid road");
      return;
    }
    const res = await service.buildRoadPath({
      requestId: uuid(),
      expectedRevision: city.revision,
      path: roadDraft,
    });
    applyCity(res);
    if (res.ok) {
      setRoadDraft([]);
      setTool("inspect");
    }
  };

  const completeOnboarding = async (name: string, specialty: Specialty) => {
    const res = await service.completeOnboarding({ name, specialty });
    applyCity(res);
  };

  const renameCity = async (name: string) => {
    if (!city) return;
    const res = await service.renameCity({
      requestId: uuid(),
      expectedRevision: city.revision,
      name,
    });
    applyCity(res);
    if (res.ok && !isDemoMapName(name) && panel === "demo") {
      setPanel("city");
    }
  };

  const openMaps = async () => {
    const res = await service.listPlayerMaps({ filter: "all" });
    if (res.ok && res.data) setDirectory(res.data.entries);
    setPanel("maps");
  };

  const visitCity = async (cityId: string) => {
    const res = await service.readCitySummary(cityId);
    if (res.ok && res.city) {
      setVisiting(res.city);
      setSceneView({ kind: "city" });
      setPanel("city");
      setTool("inspect");
    } else setError(res.error ?? "Visit failed");
  };

  const returnHome = async () => {
    setVisiting(null);
    await refresh();
  };

  const contributeOwn = async (projectId: string) => {
    if (!city) return;
    const res = await service.contributeToOwnProject({
      requestId: uuid(),
      expectedRevision: city.revision,
      projectId,
    });
    applyCity(res);
  };

  const beginProjectPlacement = (definitionId: ProjectDefId) => {
    setPendingProjectId(definitionId);
    setBuildDefId("project_site");
    setTool("project");
    setPanel("city");
  };

  const cancelUntouched = async (projectId: string) => {
    if (!city) return;
    const res = await service.cancelUntouchedProject({
      requestId: uuid(),
      expectedRevision: city.revision,
      projectId,
    });
    applyCity(res);
  };

  const supplyRun = async (resource: "coins" | "wood" | "stone" | "research") => {
    if (!city) return;
    const res = await service.takeSupplyRun({
      requestId: uuid(),
      expectedRevision: city.revision,
      resource,
    });
    applyCity(res);
  };

  const upgradeSelected = async () => {
    if (!city || !selected) return;
    const res = await service.upgradeBuilding({
      requestId: uuid(),
      expectedRevision: city.revision,
      entityId: selected.id,
    });
    applyCity(res);
  };

  const storeSelected = async () => {
    if (!city || !selected) return;
    const res = await service.storeEntity({
      requestId: uuid(),
      expectedRevision: city.revision,
      entityId: selected.id,
    });
    applyCity(res);
    setSelected(null);
  };

  const bankExchange = async (
    from: "coins" | "wood" | "stone" | "research",
    to: "coins" | "wood" | "stone" | "research"
  ) => {
    if (!city || !selected) return;
    const res = await service.bankExchange({
      requestId: uuid(),
      expectedRevision: city.revision,
      entityId: selected.id,
      from,
      to,
    });
    applyCity(res);
  };

  const sendParcel = async (amounts: {
    coins: number;
    wood: number;
    stone: number;
    research: number;
    happiness: number;
  }) => {
    if (!city || !selected) return;
    const portal = city.portals.find((p) => p.entityId === selected.id);
    if (!portal) {
      setError("Select a portal");
      return;
    }
    const res = await service.sendResourceParcel({
      requestId: uuid(),
      expectedRevision: city.revision,
      portalEntityId: portal.entityId,
      expectedAssignmentRevision: portal.assignmentRevision,
      destinationCityId: portal.destinationCityId,
      amounts,
    });
    applyCity(res);
  };

  const sendWork = async (projectId: string) => {
    if (!city || !selected) return;
    const portal = city.portals.find((p) => p.entityId === selected.id);
    if (!portal) {
      setError("Select a portal");
      return;
    }
    const res = await service.sendProjectWork({
      requestId: uuid(),
      expectedRevision: city.revision,
      portalEntityId: portal.entityId,
      expectedAssignmentRevision: portal.assignmentRevision,
      destinationCityId: portal.destinationCityId,
      projectId,
    });
    applyCity(res);
  };

  const sendPortableGift = async (inventoryItemId: string, quantity?: number) => {
    if (!city || !selected) return;
    const portal = city.portals.find((p) => p.entityId === selected.id);
    if (!portal) {
      setError("Select a portal");
      return;
    }
    const res = await service.sendPortableItem({
      requestId: uuid(),
      expectedRevision: city.revision,
      portalEntityId: portal.entityId,
      expectedAssignmentRevision: portal.assignmentRevision,
      destinationCityId: portal.destinationCityId,
      inventoryItemId,
      quantity,
    });
    applyCity(res);
  };

  const demoAdvance = async (hours: number) => {
    if (!service.demoAdvanceHours) return;
    const res = await service.demoAdvanceHours(hours);
    applyCity(res);
  };

  const demoReset = async () => {
    if (!service.demoReset) return;
    const res = await service.demoReset();
    applyCity(res);
  };

  const demoSimWork = async (projectId: string) => {
    if (!service.demoSimulatedContribution) return;
    const res = await service.demoSimulatedContribution(projectId);
    applyCity(res);
  };

  const demoGrantResources = async (amount = 100) => {
    if (!service.demoGrantResources) return;
    const res = await service.demoGrantResources(amount);
    applyCity(res);
  };

  const demoFillResources = async (amount = 99_999) => {
    if (!service.demoFillResources) return;
    const res = await service.demoFillResources(amount);
    applyCity(res);
  };

  // ---------------------------------------------------------------------
  // Expansion scenes (home, backyard, station, expedition)
  // ---------------------------------------------------------------------

  const clearLaunchFx = useCallback(() => setLaunchFx(null), []);

  /** Leave any armed city tool / drawer / selection before switching scenes. */
  const leaveCityTools = () => {
    setPanel("city");
    setSelected(null);
    setTool("inspect");
    setBuildDefId(null);
    setPendingProjectId(null);
    setRoadDraft([]);
    setError(null);
  };

  const returnToCity = () => {
    setSceneView({ kind: "city" });
    setLaunchFx(null);
    setError(null);
  };

  const enterHome = (houseEntityId?: string) => {
    if (!city || visiting) return;
    const id = houseEntityId ?? city.expansion.primaryHomeEntityId ?? null;
    const binding = id ? city.expansion.homes[id] : undefined;
    if (!id || !binding) {
      setError("Designate a house as your home first (free, no action).");
      return;
    }
    leaveCityTools();
    setSceneView({ kind: "interior", sceneId: binding.interiorSceneId, houseEntityId: id });
  };

  const enterBackyard = (houseEntityId?: string) => {
    if (!city || visiting) return;
    const id = houseEntityId ?? city.expansion.primaryHomeEntityId ?? null;
    const binding = id ? city.expansion.homes[id] : undefined;
    if (!id || !binding) {
      setError("Designate a house as your home first (free, no action).");
      return;
    }
    leaveCityTools();
    setSceneView({ kind: "backyard", sceneId: binding.backyardSceneId, houseEntityId: id });
  };

  const enterStation = (spaceCenterEntityId?: string) => {
    if (!city || visiting) return;
    const center = city.expansion.spaceCenters.find(
      (s) => s.stationId && (!spaceCenterEntityId || s.entityId === spaceCenterEntityId)
    );
    if (!center?.stationId) {
      setError("Launch the founding rocket first.");
      return;
    }
    leaveCityTools();
    setSceneView({ kind: "station", stationId: center.stationId });
  };

  const enterExpedition = (expeditionId?: string) => {
    if (!city || visiting) return;
    const active = city.expansion.activeExpedition;
    const id = expeditionId ?? (active && active.status !== "abandoned" ? active.id : "planning");
    leaveCityTools();
    setSceneView({ kind: "expedition", expeditionId: id });
  };

  /**
   * Run a service command against the current city revision and fold the
   * result into state. Stale-revision failures adopt the server city so the
   * player can simply retry.
   */
  const runCommand = async (
    fn: (c: CityState) => Promise<CommandResult>
  ): Promise<CommandResult> => {
    if (!city || visiting) {
      return { ok: false, error: "Not available right now" };
    }
    const res = await fn(city);
    if (!res.ok && res.city && res.error?.startsWith("Stale")) {
      setCity(res.city);
    }
    applyCity(res);
    return res;
  };

  const designateHome = (houseEntityId: string) =>
    runCommand((c) =>
      service.designatePrimaryHome({
        requestId: uuid(),
        expectedRevision: c.revision,
        houseEntityId,
      })
    );

  const acquireBundle = (bundleId: FurnitureBundleId) =>
    runCommand((c) =>
      service.acquireFurnitureBundle({
        requestId: uuid(),
        expectedRevision: c.revision,
        bundleId,
      })
    );

  const addRoom = (interiorSceneId: string) =>
    runCommand((c) =>
      service.addInteriorRoom({
        requestId: uuid(),
        expectedRevision: c.revision,
        interiorSceneId,
      })
    );

  const placeHomeItem: GameContextValue["placeHomeItem"] = (input) =>
    runCommand((c) =>
      service.placeHomeItem({ requestId: uuid(), expectedRevision: c.revision, ...input })
    );

  const moveHomeItem: GameContextValue["moveHomeItem"] = (input) =>
    runCommand((c) =>
      service.moveHomeItem({ requestId: uuid(), expectedRevision: c.revision, ...input })
    );

  const storeHomeItem: GameContextValue["storeHomeItem"] = (input) =>
    runCommand((c) =>
      service.storeHomeItem({ requestId: uuid(), expectedRevision: c.revision, ...input })
    );

  const buildGardenBed = (backyardSceneId: string, x: number, y: number) =>
    runCommand((c) =>
      service.buildGardenBed({
        requestId: uuid(),
        expectedRevision: c.revision,
        backyardSceneId,
        x,
        y,
      })
    );

  const plantBatch: GameContextValue["plantBatch"] = (backyardSceneId, bedItemId, changes) =>
    runCommand((c) =>
      service.plantGardenBatch({
        requestId: uuid(),
        expectedRevision: c.revision,
        backyardSceneId,
        bedItemId,
        changes,
      })
    );

  const foundingLaunch = async (spaceCenterEntityId: string) => {
    const launchId = uuid();
    const res = await runCommand((c) =>
      service.foundingLaunch({
        requestId: uuid(),
        expectedRevision: c.revision,
        spaceCenterEntityId,
        launchId,
      })
    );
    if (res.ok) {
      const stationId = (res.data as { stationId?: string } | undefined)?.stationId;
      if (!reducedMotion) setLaunchFx({ id: launchId, label: "Founding rocket away!" });
      if (stationId) {
        leaveCityTools();
        setSceneView({ kind: "station", stationId });
      }
    }
    return res;
  };

  const launchModule: GameContextValue["launchModule"] = async (input) => {
    const launchId = uuid();
    const res = await runCommand((c) =>
      service.launchStationModule({
        requestId: uuid(),
        expectedRevision: c.revision,
        launchId,
        ...input,
      })
    );
    if (res.ok && !reducedMotion) setLaunchFx({ id: launchId, label: "Module launched" });
    return res;
  };

  const launchInstrument: GameContextValue["launchInstrument"] = async (input) => {
    const launchId = uuid();
    const res = await runCommand((c) =>
      service.launchInstrument({
        requestId: uuid(),
        expectedRevision: c.revision,
        launchId,
        ...input,
      })
    );
    if (res.ok && !reducedMotion) setLaunchFx({ id: launchId, label: "Instrument launched" });
    return res;
  };

  const storeStationModule = (stationId: string, moduleId: string) =>
    runCommand((c) =>
      service.storeStationModule({
        requestId: uuid(),
        expectedRevision: c.revision,
        stationId,
        moduleId,
      })
    );

  const restoreStationModule: GameContextValue["restoreStationModule"] = (input) =>
    runCommand((c) =>
      service.restoreStationModule({
        requestId: uuid(),
        expectedRevision: c.revision,
        ...input,
      })
    );

  const listRegions = useCallback(async (): Promise<ExpeditionRegion[]> => {
    const res = await service.listExpeditionRegions();
    return res.ok && res.data ? res.data.regions : [];
  }, [service]);

  const previewChoices = useCallback(
    async (regionKey: string): Promise<ExpeditionChoice[]> => {
      const res = await service.previewExpeditionChoices({ regionKey });
      return res.ok && res.data ? res.data.choices : [];
    },
    [service]
  );

  const dispatchExpedition = async (regionKey: string, firstChoiceId: string) => {
    const res = await runCommand((c) =>
      service.dispatchExpedition({
        requestId: uuid(),
        expectedRevision: c.revision,
        regionKey,
        firstChoiceId,
      })
    );
    if (res.ok) {
      const exp = (res.data as { expedition?: { id: string } } | undefined)?.expedition;
      if (exp) setSceneView({ kind: "expedition", expeditionId: exp.id });
    }
    return res;
  };

  const expeditionStep = (choiceId: string) =>
    runCommand((c) =>
      service.expeditionStep({
        requestId: uuid(),
        expectedRevision: c.revision,
        choiceId,
      })
    );

  const recallExpedition = () =>
    runCommand((c) =>
      service.recallExpedition({ requestId: uuid(), expectedRevision: c.revision })
    );

  const abandonExpedition = () =>
    runCommand((c) =>
      service.abandonExpedition({ requestId: uuid(), expectedRevision: c.revision })
    );

  const nextWindowLabel = useMemo(() => {
    void tick;
    if (!city) return "";
    return formatDuration(msUntilNextWindow(city.economy, Date.now()));
  }, [city, tick]);

  const value: GameContextValue = {
    service,
    isMultiplayer,
    accountEmail: session?.user.email ?? null,
    signOut,
    city,
    loading,
    error,
    tool,
    setTool,
    buildDefId,
    setBuildDefId,
    selected,
    setSelected,
    roadDraft,
    setRoadDraft,
    panel,
    setPanel,
    visiting,
    directory,
    ghost,
    nextWindowLabel,
    refresh,
    handleTileClick,
    handleTileHover,
    handleEntityClick,
    completeOnboarding,
    renameCity,
    isDemoMap: isDemoMapName(city?.name),
    openMaps,
    visitCity,
    returnHome,
    contributeOwn,
    pendingProjectId,
    beginProjectPlacement,
    cancelUntouched,
    supplyRun,
    upgradeSelected,
    storeSelected,
    bankExchange,
    confirmRoad,
    portalDestinationId,
    setPortalDestinationId,
    createPortalAt,
    sendParcel,
    sendWork,
    sendPortableGift,
    demoAdvance,
    demoReset,
    demoSimWork,
    demoGrantResources,
    demoFillResources,
    reducedMotion,
    setReducedMotion,
    sceneView,
    setSceneView,
    enterHome,
    enterBackyard,
    enterStation,
    enterExpedition,
    returnToCity,
    launchFx,
    clearLaunchFx,
    designateHome,
    acquireBundle,
    addRoom,
    placeHomeItem,
    moveHomeItem,
    storeHomeItem,
    buildGardenBed,
    plantBatch,
    foundingLaunch,
    launchModule,
    launchInstrument,
    storeStationModule,
    restoreStationModule,
    listRegions,
    previewChoices,
    dispatchExpedition,
    expeditionStep,
    recallExpedition,
    abandonExpedition,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export { getBuilding };
