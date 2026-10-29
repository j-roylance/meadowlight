import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import type { CommandResult, Specialty } from "@/game/types";
import type { GameService } from "@/game/adapters/types";
import { createWorldService, type WorldStore } from "@/game/engine/worldService";
import { createStarterCity } from "@/game/simulation/starter";
import {
  ensureCityForUser,
  listDirectory,
  loadCitySnapshot,
  loadCommerce,
  projectVisitSummary,
  saveCitySnapshot,
  saveCommerce,
} from "@/game/engine/mpPersistence";
import { reviveBigints } from "@/game/engine/serialize";

const CROSS_CITY_COMMANDS = new Set([
  "sendResourceParcel",
  "sendProjectWork",
  "sendPortableItem",
  "createAssignedPortal",
  "reassignPortal",
  "readCitySummary",
]);

function destinationFromInput(command: string, input: Record<string, unknown>): string | null {
  if (typeof input.destinationCityId === "string") return input.destinationCityId;
  if (command === "readCitySummary" && typeof input.cityId === "string") return input.cityId;
  return null;
}

function reviveInput(input: unknown): unknown {
  return reviveBigints(input);
}

export async function runMultiplayerCommand(opts: {
  admin: SupabaseClient;
  user: User;
  command: string;
  input?: Record<string, unknown>;
}): Promise<CommandResult> {
  const { admin, user, command } = opts;
  const input = (reviveInput(opts.input ?? {}) ?? {}) as Record<string, unknown>;

  if (command === "listPlayerMaps") {
    const entries = await listDirectory(
      admin,
      user.id,
      typeof input.query === "string" ? input.query : undefined
    );
    const city = await ensureCityForUser(admin, user.id);
    return { ok: true, city, data: { entries } };
  }

  if (command === "readCitySummary") {
    const cityId = String(input.cityId ?? "");
    const snap = await loadCitySnapshot(admin, cityId);
    if (!snap) return { ok: false, error: "City not found" };
    // Match local demo: visited city is returned on `city` (economy stripped for privacy).
    const publicCity = projectVisitSummary(snap);
    if (snap.ownerId !== user.id) {
      publicCity.economy = {
        ...publicCity.economy,
        coins: 0,
        wood: 0,
        stone: 0,
        research: 0,
        happiness: 0,
        actionsRemaining: 0,
      };
    }
    return { ok: true, city: publicCity, data: publicCity };
  }

  let player = await ensureCityForUser(admin, user.id, {
    name: typeof input.name === "string" ? input.name : undefined,
    specialty: input.specialty as Specialty | undefined,
    displayName: typeof input.displayName === "string" ? input.displayName : undefined,
  });

  if (!player.entities?.length) {
    const name =
      (typeof input.name === "string" && input.name.trim()) || player.name || "Meadowlight";
    const specialty = (input.specialty as Specialty) || player.specialty || "markets";
    player = createStarterCity({
      id: player.id,
      ownerId: user.id,
      name,
      displayName:
        (typeof input.displayName === "string" && input.displayName.trim()) || name,
      specialty,
      now: Date.now(),
      seed: player.seed,
    });
    player.onboardingComplete = false;
  }

  const destId = CROSS_CITY_COMMANDS.has(command)
    ? destinationFromInput(command, input)
    : null;

  const neighbors: typeof player[] = [];
  if (destId && destId !== player.id) {
    const dest = await loadCitySnapshot(admin, destId);
    if (dest) neighbors.push(dest);
  }

  const commerce = await loadCommerce(admin);
  let memory: WorldStore = {
    player,
    neighbors,
    clockOffsetMs: 0,
    receipts: {},
    commerce,
  };

  if (typeof input.requestId === "string") {
    const { data: receipt } = await admin
      .from("command_receipts")
      .select("result")
      .eq("actor_id", user.id)
      .eq("request_id", input.requestId)
      .maybeSingle();
    if (receipt?.result) {
      return reviveBigints<CommandResult>(receipt.result);
    }
  }

  const service = createWorldService({
    mode: "multiplayer",
    modeLabel: "Meadowlight multiplayer",
    persistence: {
      load: () => memory,
      save: (s) => {
        memory = s;
      },
    },
    createInitialStore: () => memory,
    directoryMode: "all_neighbors",
    enableDemoTools: false,
  });

  if (command.startsWith("demo")) {
    return { ok: false, error: "Demo tools unavailable in multiplayer", city: player };
  }

  const fn = (service as unknown as Record<string, (arg?: unknown) => Promise<CommandResult>>)[
    command
  ];
  if (typeof fn !== "function") {
    return { ok: false, error: `Unknown command: ${command}`, city: player };
  }

  const res = await fn.call(service, input);
  await persistStore(admin, memory, user.id, input.requestId as string | undefined, res);
  return res;
}

async function persistStore(
  admin: SupabaseClient,
  store: WorldStore,
  userId: string,
  requestId: string | undefined,
  result: CommandResult
) {
  await saveCitySnapshot(admin, store.player);
  for (const n of store.neighbors) {
    await saveCitySnapshot(admin, n);
  }
  await saveCommerce(admin, store.commerce);

  if (requestId) {
    await admin.from("command_receipts").upsert({
      actor_id: userId,
      request_id: requestId,
      payload_hash: "n/a",
      result: JSON.parse(JSON.stringify(result, (_k, v) =>
        typeof v === "bigint" ? { __bigint: v.toString() } : v
      )),
    });
  }
}

export type { GameService };
