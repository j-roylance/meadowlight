import type { GameService } from "./types";
import type { CommandResult } from "@/game/types";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { parseState } from "@/game/engine/serialize";

async function callApi<T = unknown>(
  command: string,
  input?: Record<string, unknown>
): Promise<CommandResult<T>> {
  const sb = createBrowserSupabase();
  const { data: sessionData } = await sb.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    return { ok: false, error: "Sign in required" };
  }

  const body = JSON.stringify(
    { command, input: input ?? {} },
    (_k, v) => (typeof v === "bigint" ? { __bigint: v.toString() } : v)
  );

  const res = await fetch("/api/game", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body,
  });

  const text = await res.text();
  try {
    return parseState<CommandResult<T>>(text);
  } catch {
    return { ok: false, error: text || `HTTP ${res.status}` };
  }
}

function method(command: string) {
  return (input: Record<string, unknown>) => callApi(command, input);
}

/** Authenticated multiplayer GameService — all mutations go through /api/game. */
export function createSupabaseGameService(): GameService {
  return {
    mode: "multiplayer",
    modeLabel: "Meadowlight multiplayer",

    syncMyCity: () => callApi("syncMyCity"),
    createCity: (input) => callApi("createCity", { ...input }),
    completeOnboarding: (input) => callApi("completeOnboarding", { ...input }),
    renameCity: method("renameCity"),
    listPlayerMaps: (opts) => callApi("listPlayerMaps", { ...(opts ?? {}) }),
    readCitySummary: (cityId) => callApi("readCitySummary", { cityId }),
    placeBuilding: method("placeBuilding"),
    upgradeBuilding: method("upgradeBuilding"),
    buildRoadPath: method("buildRoadPath"),
    eraseOwnedRoads: method("eraseOwnedRoads"),
    repositionEntity: method("repositionEntity"),
    storeEntity: method("storeEntity"),
    restoreEntity: method("restoreEntity"),
    createAssignedPortal: method("createAssignedPortal"),
    reassignPortal: method("reassignPortal"),
    sendResourceParcel: method("sendResourceParcel"),
    sendProjectWork: method("sendProjectWork"),
    contributeToOwnProject: method("contributeToOwnProject"),
    takeSupplyRun: method("takeSupplyRun"),
    harvestTile: method("harvestTile"),
    bankExchange: method("bankExchange"),
    startHostedProject: method("startHostedProject"),
    cancelUntouchedProject: method("cancelUntouchedProject"),
    placeLandmark: method("placeLandmark"),
    setInboundDeliveryPolicy: method("setInboundDeliveryPolicy"),
    designatePrimaryHome: method("designatePrimaryHome"),
    setHomePrivacy: method("setHomePrivacy"),
    acquireFurnitureBundle: method("acquireFurnitureBundle"),
    addInteriorRoom: method("addInteriorRoom"),
    placeHomeItem: method("placeHomeItem"),
    moveHomeItem: method("moveHomeItem"),
    storeHomeItem: method("storeHomeItem"),
    buildGardenBed: method("buildGardenBed"),
    plantGardenBatch: method("plantGardenBatch"),
    foundingLaunch: method("foundingLaunch"),
    launchStationModule: method("launchStationModule"),
    launchInstrument: method("launchInstrument"),
    storeStationModule: method("storeStationModule"),
    restoreStationModule: method("restoreStationModule"),
    listExpeditionRegions: () => callApi("listExpeditionRegions"),
    previewExpeditionChoices: method("previewExpeditionChoices"),
    dispatchExpedition: method("dispatchExpedition"),
    expeditionStep: method("expeditionStep"),
    recallExpedition: method("recallExpedition"),
    abandonExpedition: method("abandonExpedition"),
    sendPortableItem: method("sendPortableItem"),
  } as GameService;
}
