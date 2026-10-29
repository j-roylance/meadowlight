import {
  ENCOUNTER_TEMPLATES,
  EXPEDITION_BASE_REWARD,
  EXPEDITION_DECISIONS,
  EXPEDITION_MAP_SIZE,
  EXPEDITION_MAX_RESEARCH,
  SPACE_RESEARCH_UNIT,
  type BiomeFamily,
} from "@/game/catalog/expansion";
import type {
  CityState,
  ExpansionState,
  ExpeditionChoice,
  ExpeditionInstance,
  ExpeditionRegion,
  PartyMember,
  Resources,
} from "@/game/types";
import { worldToChunk } from "./coords";
import { hasOperationalInstrument } from "./space";
import { v4 as uuid } from "uuid";

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function chunkKeyFromWorld(x: bigint, y: bigint): string {
  const { chunk } = worldToChunk(x, y);
  return `${chunk.cx.toString()},${chunk.cy.toString()}`;
}

export function biomeForChunk(seed: number, cx: bigint, cy: bigint): BiomeFamily {
  const families: BiomeFamily[] = ["forest", "cave", "river", "coastal"];
  const n = Number((cx * 73856093n) ^ (cy * 19349663n) ^ BigInt(seed)) >>> 0;
  return families[n % families.length];
}

export function syncClaimedRegions(city: CityState): CityState {
  const regions = { ...city.expansion.regions };
  const mark = (x: bigint, y: bigint) => {
    const key = chunkKeyFromWorld(x, y);
    const [cx, cy] = key.split(",").map((s) => BigInt(s));
    if (!regions[key]) {
      regions[key] = {
        chunkKey: key,
        claimed: true,
        surveyed: false,
        biome: biomeForChunk(city.seed, cx, cy),
        encounterSeed: (Number(cx) * 1009 + Number(cy) * 9176 + city.seed) >>> 0,
      };
    } else {
      regions[key] = { ...regions[key], claimed: true };
    }
  };
  for (const e of city.entities) {
    if (e.stored) continue;
    mark(e.x, e.y);
  }
  for (const r of city.roads) mark(r.x, r.y);
  return {
    ...city,
    expansion: { ...city.expansion, regions },
  };
}

export function nearbyExpeditionRegions(city: CityState): ExpeditionRegion[] {
  const synced = syncClaimedRegions(city);
  const regions = { ...synced.expansion.regions };
  // Offer nearby unclaimed chunks around arrival.
  const origin = worldToChunk(city.arrivalX, city.arrivalY).chunk;
  const out: ExpeditionRegion[] = [];
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      if (dx === 0 && dy === 0) continue;
      const cx = origin.cx + BigInt(dx);
      const cy = origin.cy + BigInt(dy);
      const key = `${cx.toString()},${cy.toString()}`;
      if (!regions[key]) {
        regions[key] = {
          chunkKey: key,
          claimed: false,
          surveyed: false,
          biome: biomeForChunk(city.seed, cx, cy),
          encounterSeed: (Number(cx) * 1009 + Number(cy) * 9176 + city.seed) >>> 0,
        };
      }
      const region = regions[key];
      if (!region.claimed || !region.surveyed) out.push(region);
    }
  }
  return out.slice(0, 8);
}

export function defaultParty(): PartyMember[] {
  return [
    { id: uuid(), role: "cartographer", name: "Mapa", cosmetic: "cloak_green" },
    { id: uuid(), role: "botanist", name: "Briar", cosmetic: "hat_straw" },
    { id: uuid(), role: "engineer", name: "Kit", cosmetic: "goggles" },
  ];
}

function templatesForBiome(biome: BiomeFamily) {
  return ENCOUNTER_TEMPLATES.filter((t) => t.biome === biome);
}

function buildChoices(
  seed: number,
  stepIndex: number,
  partyX: number,
  partyY: number,
  biome: BiomeFamily,
  surveyHint: boolean
): ExpeditionChoice[] {
  const rng = mulberry32(seed + stepIndex * 97 + partyX * 13 + partyY * 7);
  const templates = templatesForBiome(biome);
  const dirs = [
    { dx: 0, dy: -1, label: "North path" },
    { dx: 1, dy: 0, label: "East trail" },
    { dx: 0, dy: 1, label: "South path" },
    { dx: -1, dy: 0, label: "West trail" },
  ];
  // Pick two useful adjacent options.
  const shuffled = [...dirs].sort(() => rng() - 0.5).slice(0, 2);
  return shuffled.map((d, i) => {
    const tmpl = templates[Math.floor(rng() * templates.length)] ?? templates[0];
    const tx = Math.max(0, Math.min(EXPEDITION_MAP_SIZE - 1, partyX + d.dx));
    const ty = Math.max(0, Math.min(EXPEDITION_MAP_SIZE - 1, partyY + d.dy));
    const clue = surveyHint
      ? `Survey hint: likely ${tmpl.title.toLowerCase()} ahead.`
      : `Coarse clue: ${d.label.toLowerCase()} looks promising.`;
    return {
      id: `choice-${stepIndex}-${i}`,
      label: `${d.label}: ${tmpl.title}`,
      clue,
      targetX: tx,
      targetY: ty,
      encounterTemplateId: tmpl.id,
    };
  });
}

export function startExpedition(
  city: CityState,
  regionKey: string,
  firstChoiceId: string
): { ok: true; city: CityState; expedition: ExpeditionInstance } | { ok: false; error: string } {
  const regions = nearbyExpeditionRegions(city);
  let region = city.expansion.regions[regionKey] ?? regions.find((r) => r.chunkKey === regionKey);
  if (!region) return { ok: false, error: "Region unavailable" };
  if (city.expansion.activeExpedition?.status === "active") {
    return { ok: false, error: "A party is already exploring" };
  }

  // Persist region if newly offered.
  const party = city.expansion.party ?? defaultParty();
  let expansion: ExpansionState = {
    ...city.expansion,
    regions: {
      ...city.expansion.regions,
      [region.chunkKey]: region,
    },
    party,
  };

  const size = EXPEDITION_MAP_SIZE;
  const startX = Math.floor(size / 2);
  const startY = size - 1;
  const revealed = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      revealed.push({
        x,
        y,
        revealed: x === startX && y === startY,
        terrain: region.biome,
      });
    }
  }

  const surveyHint = hasOperationalInstrument(expansion, "survey_console");
  const choices = buildChoices(region.encounterSeed, 0, startX, startY, region.biome, surveyHint);
  const first = choices.find((c) => c.id === firstChoiceId) ?? choices[0];
  if (!first) return { ok: false, error: "No route choices" };

  // Resolve first step immediately (dispatch includes first decision).
  const stepped = applyStep(
    {
      id: uuid(),
      regionKey: region.chunkKey,
      biome: region.biome,
      seed: region.encounterSeed,
      stepIndex: 0,
      partyX: startX,
      partyY: startY,
      revealed,
      availableChoices: choices,
      rewards: [],
      journal: [{ at: Date.now(), text: "Party dispatched." }],
      status: "active",
    },
    first.id,
    expansion,
    Date.now()
  );
  if (!stepped.ok) return stepped;

  expansion = {
    ...stepped.expansion,
    activeExpedition: stepped.expedition,
    regions: {
      ...stepped.expansion.regions,
      [region.chunkKey]: {
        ...region,
        attemptId: stepped.expedition.id,
      },
    },
  };

  return {
    ok: true,
    city: { ...city, expansion },
    expedition: stepped.expedition,
  };
}

export function previewFirstChoices(city: CityState, regionKey: string): ExpeditionChoice[] {
  const regions = nearbyExpeditionRegions(city);
  const region = city.expansion.regions[regionKey] ?? regions.find((r) => r.chunkKey === regionKey);
  if (!region) return [];
  const surveyHint = hasOperationalInstrument(city.expansion, "survey_console");
  const size = EXPEDITION_MAP_SIZE;
  return buildChoices(
    region.encounterSeed,
    0,
    Math.floor(size / 2),
    size - 1,
    region.biome,
    surveyHint
  );
}

function applyStep(
  expedition: ExpeditionInstance,
  choiceId: string,
  expansion: CityState["expansion"],
  now: number
):
  | {
      ok: true;
      expedition: ExpeditionInstance;
      expansion: CityState["expansion"];
      reward: Resources;
      discovery?: string;
    }
  | { ok: false; error: string } {
  if (expedition.status !== "active" && expedition.status !== "paused") {
    return { ok: false, error: "Expedition is not active" };
  }
  if (expedition.stepIndex >= EXPEDITION_DECISIONS) {
    return { ok: false, error: "Outing already complete" };
  }
  const choice = expedition.availableChoices.find((c) => c.id === choiceId);
  if (!choice) return { ok: false, error: "Invalid choice" };

  // Hide full map: only reveal chosen cell + adjacent fog edges.
  const revealed = expedition.revealed.map((cell) => {
    const dist = Math.abs(cell.x - choice.targetX) + Math.abs(cell.y - choice.targetY);
    if (dist === 0) {
      return { ...cell, revealed: true, encounterId: choice.encounterTemplateId };
    }
    if (dist === 1) return { ...cell, revealed: true };
    return cell;
  });

  const tmpl =
    ENCOUNTER_TEMPLATES.find((t) => t.id === choice.encounterTemplateId) ??
    ENCOUNTER_TEMPLATES[0];
  let reward: Resources = { ...tmpl.reward };
  // Cap research per step.
  if (reward.research > EXPEDITION_MAX_RESEARCH) {
    reward = { ...reward, research: EXPEDITION_MAX_RESEARCH };
  }
  // Never auto-refund happiness cost.
  reward = { ...reward, happiness: 0 };

  const receipt = {
    stepIndex: expedition.stepIndex,
    choiceId: choice.id,
    resources: reward,
    discovery: tmpl.discovery,
    credited: true,
  };

  const nextStep = (expedition.stepIndex + 1) as 0 | 1 | 2 | 3 | 4;
  const complete = nextStep >= EXPEDITION_DECISIONS;
  const surveyHint = hasOperationalInstrument(expansion, "survey_console");
  const nextChoices = complete
    ? []
    : buildChoices(
        expedition.seed,
        nextStep,
        choice.targetX,
        choice.targetY,
        expedition.biome,
        surveyHint
      );

  let specialDiscovery = expedition.specialDiscovery;
  if (complete && !specialDiscovery) {
    specialDiscovery = `${expedition.biome} survey seal`;
  }

  const next: ExpeditionInstance = {
    ...expedition,
    stepIndex: nextStep,
    partyX: choice.targetX,
    partyY: choice.targetY,
    revealed,
    availableChoices: nextChoices,
    rewards: [...expedition.rewards, receipt],
    journal: [
      ...expedition.journal,
      { at: now, text: `${tmpl.title}: ${tmpl.description}` },
    ],
    status: complete ? "complete" : "active",
    specialDiscovery,
  };

  let nextExpansion = expansion;
  if (complete) {
    const region = nextExpansion.regions[expedition.regionKey];
    if (region) {
      nextExpansion = {
        ...nextExpansion,
        regions: {
          ...nextExpansion.regions,
          [expedition.regionKey]: { ...region, surveyed: true },
        },
      };
    }
    if (specialDiscovery) {
      nextExpansion = {
        ...nextExpansion,
        inventory: [
          ...nextExpansion.inventory,
          {
            id: uuid(),
            kind: "discovery",
            definitionId: specialDiscovery,
            quantity: 1,
          },
        ],
      };
    }
  }

  return {
    ok: true,
    expedition: next,
    expansion: { ...nextExpansion, activeExpedition: next },
    reward,
    discovery: tmpl.discovery,
  };
}

export function advanceExpedition(
  city: CityState,
  choiceId: string,
  now: number
):
  | {
      ok: true;
      city: CityState;
      reward: Resources;
      discovery?: string;
      expedition: ExpeditionInstance;
    }
  | { ok: false; error: string } {
  const expedition = city.expansion.activeExpedition;
  if (!expedition || (expedition.status !== "active" && expedition.status !== "paused")) {
    return { ok: false, error: "No active expedition" };
  }
  // Resume paused.
  const active = { ...expedition, status: "active" as const };
  const result = applyStep(active, choiceId, city.expansion, now);
  if (!result.ok) return result;
  return {
    ok: true,
    city: { ...city, expansion: result.expansion },
    reward: result.reward,
    discovery: result.discovery,
    expedition: result.expedition,
  };
}

export function recallExpedition(city: CityState): CityState {
  const exp = city.expansion.activeExpedition;
  if (!exp || exp.status === "complete") return city;
  return {
    ...city,
    expansion: {
      ...city.expansion,
      activeExpedition: { ...exp, status: "paused" },
    },
  };
}

export function abandonExpedition(city: CityState): CityState {
  const exp = city.expansion.activeExpedition;
  if (!exp) return city;
  return {
    ...city,
    expansion: {
      ...city.expansion,
      activeExpedition: { ...exp, status: "abandoned" },
    },
  };
}

/** Public client view strips hidden encounter solutions. */
export function publicExpeditionView(exp: ExpeditionInstance): ExpeditionInstance {
  return {
    ...exp,
    revealed: exp.revealed.map((c) =>
      c.revealed ? c : { x: c.x, y: c.y, revealed: false, terrain: "fog" }
    ),
    // Choices only expose clues, not future templates beyond available ones.
    availableChoices: exp.availableChoices.map((c) => ({
      ...c,
      // Keep template id server-side only in live mode; demo keeps for resolution.
    })),
  };
}

export function starterRewardFallback(): Resources {
  return { ...EXPEDITION_BASE_REWARD };
}

export function researchCap(): number {
  return Math.min(EXPEDITION_MAX_RESEARCH, SPACE_RESEARCH_UNIT);
}
