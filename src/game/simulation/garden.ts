import {
  BACKYARD_FLOWER_BED_HAPPINESS,
  PLANTS,
  type PlantVarietyId,
} from "@/game/catalog/expansion";
import type {
  BackyardScene,
  CityState,
  ExpansionState,
  GardenBedState,
  GardenPlot,
  InventoryItem,
} from "@/game/types";
import { v4 as uuid } from "uuid";

export function emptyBedSlots(): GardenPlot[] {
  return [0, 1, 2, 3].map((slotIndex) => ({
    slotIndex: slotIndex as 0 | 1 | 2 | 3,
    varietyId: null,
    plantingCycleId: null,
    plantedAt: null,
    matureAt: null,
    harvestCredited: false,
  }));
}

export function createEmptyBed(bedId = uuid()): GardenBedState {
  return { bedId, slots: emptyBedSlots() };
}

function isMature(slot: GardenPlot, now: number): boolean {
  return Boolean(slot.matureAt && now >= slot.matureAt && slot.varietyId);
}

/** Once-only harvest credit for a planting cycle. */
export function settleBedHarvests(
  expansion: ExpansionState,
  bed: GardenBedState,
  now: number
): { expansion: ExpansionState; bed: GardenBedState; credited: string[] } {
  const credited: string[] = [];
  let next = expansion;
  const slots = bed.slots.map((slot) => {
    if (!slot.varietyId || !slot.plantingCycleId || !isMature(slot, now)) return slot;
    if (slot.harvestCredited) return slot;
    const receiptKey = `${slot.plantingCycleId}:harvest`;
    if (next.harvestReceipts[receiptKey]) {
      return { ...slot, harvestCredited: true };
    }
    const plant = PLANTS[slot.varietyId];
    if (!plant) return slot;
    const item: InventoryItem = {
      id: uuid(),
      kind: "harvest",
      definitionId: plant.harvestItemId,
      quantity: 1,
    };
    next = {
      ...next,
      harvestReceipts: { ...next.harvestReceipts, [receiptKey]: true },
      inventory: [...next.inventory, item],
    };
    credited.push(plant.harvestName);
    return { ...slot, harvestCredited: true };
  });
  return { expansion: next, bed: { ...bed, slots }, credited };
}

/** Happiness rate for one placed bed based on mature flower fraction. */
export function bedHappinessRate(bed: GardenBedState, now: number): number {
  let matureFlowers = 0;
  for (const slot of bed.slots) {
    if (!slot.varietyId || !isMature(slot, now)) continue;
    const plant = PLANTS[slot.varietyId];
    if (plant?.family === "flower" && plant.happinessShare > 0) matureFlowers += 1;
  }
  // Scale full-bed rate by mature flower fraction (4 slots).
  const fraction = matureFlowers / 4;
  // Match flower_garden L1 = 1 when fully flowered; use catalog precision.
  return Math.round(BACKYARD_FLOWER_BED_HAPPINESS * fraction * 1000) / 1000;
}

function collectPlacedBeds(backyards: Record<string, BackyardScene>): GardenBedState[] {
  const beds: GardenBedState[] = [];
  for (const scene of Object.values(backyards)) {
    for (const item of scene.items) {
      if (item.definitionId === "raised_bed" && item.bedState) beds.push(item.bedState);
    }
  }
  return beds;
}

/**
 * Settle harvests and recompute backyard happiness rate.
 * Integrates maturity boundaries for rate changes during offline intervals
 * by settling production at known maturity timestamps in economy settle path.
 */
export function settleGardens(city: CityState, now: number): CityState {
  let expansion = city.expansion;
  const backyards: Record<string, BackyardScene> = { ...expansion.backyards };

  for (const [sceneId, scene] of Object.entries(backyards)) {
    const items = scene.items.map((item) => {
      if (item.definitionId !== "raised_bed" || !item.bedState) return item;
      const settled = settleBedHarvests(expansion, item.bedState, now);
      expansion = settled.expansion;
      return { ...item, bedState: settled.bed };
    });
    backyards[sceneId] = { ...scene, items };
  }

  // Also settle beds sitting in inventory (growth continues; no happiness).
  const inventory = expansion.inventory.map((inv) => {
    if (inv.definitionId !== "raised_bed" || !inv.bedState) return inv;
    const settled = settleBedHarvests(expansion, inv.bedState, now);
    expansion = settled.expansion;
    return { ...inv, bedState: settled.bed };
  });

  expansion = { ...expansion, backyards, inventory };

  let rate = 0;
  for (const bed of collectPlacedBeds(backyards)) {
    rate += bedHappinessRate(bed, now);
  }
  expansion = {
    ...expansion,
    backyardHappinessRate: Math.round(rate * 1000) / 1000,
  };

  return { ...city, expansion };
}

/** Known maturity timestamps ahead of `from` up to `to` for piecewise rate settle. */
export function upcomingMaturityTimes(
  city: CityState,
  from: number,
  to: number
): number[] {
  const times = new Set<number>();
  const consider = (bed: GardenBedState) => {
    for (const slot of bed.slots) {
      if (slot.matureAt && slot.matureAt > from && slot.matureAt <= to && !slot.harvestCredited) {
        times.add(slot.matureAt);
      } else if (slot.matureAt && slot.matureAt > from && slot.matureAt <= to) {
        times.add(slot.matureAt);
      }
    }
  };
  for (const bed of collectPlacedBeds(city.expansion.backyards)) consider(bed);
  for (const inv of city.expansion.inventory) {
    if (inv.bedState) consider(inv.bedState);
  }
  return [...times].sort((a, b) => a - b);
}

export function plantSlots(
  bed: GardenBedState,
  changes: { slotIndex: number; varietyId: PlantVarietyId | null }[],
  now: number,
  expansion: ExpansionState
):
  | {
      ok: true;
      bed: GardenBedState;
      expansion: ExpansionState;
      /** Slots that incur the 2-coin planting fee (not uproots). */
      plantedCount: number;
      uprootedCount: number;
    }
  | { ok: false; error: string } {
  if (changes.length === 0) return { ok: false, error: "No planting changes" };
  if (changes.length > 4) return { ok: false, error: "At most four slots per batch" };

  let nextExpansion = expansion;
  let slots = [...bed.slots];
  let plantedCount = 0;
  let uprootedCount = 0;

  for (const change of changes) {
    if (change.slotIndex < 0 || change.slotIndex > 3) {
      return { ok: false, error: "Invalid slot" };
    }
    // Settle harvest before replant/uproot.
    const settled = settleBedHarvests(nextExpansion, { ...bed, slots }, now);
    nextExpansion = settled.expansion;
    slots = settled.bed.slots;
    const afterSettle = slots[change.slotIndex];

    if (change.varietyId === null) {
      // Uproot — free, no harvest if immature (already settled if mature).
      if (!afterSettle.varietyId) continue;
      slots[change.slotIndex] = {
        slotIndex: afterSettle.slotIndex,
        varietyId: null,
        plantingCycleId: null,
        plantedAt: null,
        matureAt: null,
        harvestCredited: false,
      };
      uprootedCount += 1;
      continue;
    }

    if (!nextExpansion.seedUnlocks.includes(change.varietyId)) {
      return { ok: false, error: "Seed variety locked" };
    }
    const plant = PLANTS[change.varietyId];
    if (!plant) return { ok: false, error: "Unknown variety" };

    if (
      afterSettle.varietyId === change.varietyId &&
      afterSettle.plantingCycleId &&
      !afterSettle.harvestCredited
    ) {
      // Same growing plant — no change.
      continue;
    }

    const cycleId = uuid();
    slots[change.slotIndex] = {
      slotIndex: afterSettle.slotIndex,
      varietyId: change.varietyId,
      plantingCycleId: cycleId,
      plantedAt: now,
      matureAt: now + plant.maturityMs,
      harvestCredited: false,
    };
    plantedCount += 1;
  }

  if (plantedCount === 0 && uprootedCount === 0) {
    return { ok: false, error: "No planting changes" };
  }
  return {
    ok: true,
    bed: { ...bed, slots },
    expansion: nextExpansion,
    plantedCount,
    uprootedCount,
  };
}
