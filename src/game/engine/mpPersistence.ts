import type { SupabaseClient } from "@supabase/supabase-js";
import type { CityState, Specialty } from "@/game/types";
import { createStarterCity } from "@/game/simulation/starter";
import { migrateCity, type WorldStore } from "@/game/engine/worldService";
import { reviveBigints, stringifyState } from "@/game/engine/serialize";

type CommercePair = WorldStore["commerce"][number];

function economyPatch(city: CityState) {
  const e = city.economy;
  return {
    coins: e.coins,
    wood: e.wood,
    stone: e.stone,
    research: e.research,
    happiness: e.happiness,
    rem_coins: e.remCoins,
    rem_wood: e.remWood,
    rem_stone: e.remStone,
    rem_research: e.remResearch,
    rem_happiness: e.remHappiness,
    rate_coins: e.rateCoins,
    rate_wood: e.rateWood,
    rate_stone: e.rateStone,
    rate_research: e.rateResearch,
    rate_happiness: e.rateHappiness,
    last_settled_at: new Date(e.lastSettledAt).toISOString(),
    actions_remaining: e.actionsRemaining,
    action_window_start_at: new Date(e.actionWindowStartAt).toISOString(),
  };
}

export async function loadCommerce(admin: SupabaseClient): Promise<CommercePair[]> {
  const { data, error } = await admin.from("mp_commerce").select("pairs").eq("id", 1).maybeSingle();
  if (error) throw new Error(error.message);
  const pairs = data?.pairs ?? [];
  return reviveBigints<CommercePair[]>(pairs);
}

export async function saveCommerce(admin: SupabaseClient, pairs: CommercePair[]) {
  const { error } = await admin
    .from("mp_commerce")
    .upsert({ id: 1, pairs: JSON.parse(stringifyState(pairs)), updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export async function loadCitySnapshot(
  admin: SupabaseClient,
  cityId: string
): Promise<CityState | null> {
  const { data, error } = await admin
    .from("city_snapshots")
    .select("state, revision")
    .eq("city_id", cityId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !data.state || Object.keys(data.state as object).length === 0) {
    return null;
  }
  const city = migrateCity(reviveBigints<CityState>(data.state));
  city.revision = Number(data.revision ?? city.revision);
  return city;
}

export async function saveCitySnapshot(admin: SupabaseClient, city: CityState) {
  const payload = JSON.parse(stringifyState(city));
  const { error: snapErr } = await admin.from("city_snapshots").upsert({
    city_id: city.id,
    revision: city.revision,
    state: payload,
    updated_at: new Date().toISOString(),
  });
  if (snapErr) throw new Error(snapErr.message);

  const { error: cityErr } = await admin
    .from("cities")
    .update({
      name: city.name,
      specialty: city.specialty,
      revision: city.revision,
      onboarding_complete: city.onboardingComplete,
      seed: Number(city.seed),
      arrival_x: city.arrivalX.toString(),
      arrival_y: city.arrivalY.toString(),
    })
    .eq("id", city.id);
  if (cityErr) throw new Error(cityErr.message);

  const { error: ecoErr } = await admin
    .from("city_economy")
    .update(economyPatch(city))
    .eq("city_id", city.id);
  if (ecoErr) throw new Error(ecoErr.message);

  const { error: delErr } = await admin
    .from("delivery_policies")
    .upsert({ city_id: city.id, inbound_enabled: city.delivery.inboundEnabled });
  if (delErr) throw new Error(delErr.message);

  const { error: profileErr } = await admin
    .from("profiles")
    .update({ display_name: city.displayName })
    .eq("id", city.ownerId);
  if (profileErr) throw new Error(profileErr.message);
}

export async function getOwnedCityRow(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from("cities")
    .select("id, name, specialty, seed, scene_id, onboarding_complete, revision")
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function ensureCityForUser(
  admin: SupabaseClient,
  userId: string,
  opts?: { name?: string; specialty?: Specialty; displayName?: string }
): Promise<CityState> {
  let row = await getOwnedCityRow(admin, userId);
  if (!row) {
    // Prefer RPC with user JWT when available; fallback service insert for bootstrap tests.
    const name = opts?.name?.trim() || "Meadowlight";
    const specialty = opts?.specialty ?? "markets";
    const { data: profile } = await admin
      .from("profiles")
      .upsert({ id: userId, display_name: opts?.displayName ?? name })
      .select()
      .maybeSingle();

    const seed = Date.now();
    const { data: city, error } = await admin
      .from("cities")
      .insert({
        owner_id: userId,
        name,
        specialty,
        seed,
        onboarding_complete: false,
      })
      .select("id, name, specialty, seed, scene_id, onboarding_complete, revision")
      .single();
    if (error) throw new Error(error.message);
    row = city;
    await admin.from("city_economy").insert({ city_id: city.id });
    await admin.from("delivery_policies").insert({ city_id: city.id });
    await admin.from("city_expansion").insert({ city_id: city.id });
    await admin.from("city_snapshots").insert({ city_id: city.id, revision: 1, state: {} });
    void profile;
  }

  let city = await loadCitySnapshot(admin, row.id);
  if (!city) {
    city = createStarterCity({
      id: row.id,
      ownerId: userId,
      name: row.name,
      displayName: opts?.displayName ?? row.name,
      specialty: (row.specialty === "timber" ? "wood" : row.specialty) as Specialty,
      now: Date.now(),
      seed: Number(row.seed),
    });
    city.onboardingComplete = Boolean(row.onboarding_complete);
    await saveCitySnapshot(admin, city);
  }
  return city;
}

export async function listDirectory(
  admin: SupabaseClient,
  userId: string,
  query?: string
) {
  let q = admin
    .from("cities")
    .select("id, name, specialty, owner_id, profiles(display_name)")
    .eq("onboarding_complete", true)
    .neq("owner_id", userId)
    .order("name")
    .limit(100);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const entries = (data ?? []).map((row) => {
    const profile = row.profiles as { display_name?: string } | { display_name?: string }[] | null;
    const displayName = Array.isArray(profile)
      ? profile[0]?.display_name
      : profile?.display_name;
    return {
      cityId: row.id as string,
      name: row.name as string,
      displayName: displayName || (row.name as string),
      specialty: (row.specialty === "timber" ? "wood" : row.specialty) as Specialty,
      population: 8,
      amenity: 4,
      projectStatus: "—",
      simulated: false,
    };
  });
  if (!query?.trim()) return entries;
  const needle = query.trim().toLowerCase();
  return entries.filter(
    (e) =>
      e.name.toLowerCase().includes(needle) ||
      e.displayName.toLowerCase().includes(needle)
  );
}

export function projectVisitSummary(city: CityState): CityState {
  const privacy = city.expansion?.homePrivacy ?? "private";
  if (privacy === "public_readonly") return city;
  return {
    ...city,
    expansion: {
      ...city.expansion,
      interiors: {},
      backyards: {},
      inventory: [],
    },
  };
}
