import type { CityState, PlacedEntity, ResourceKey, Resources } from "@/game/types";
import { BANK_EXCHANGE_AMOUNT, ZERO_RESOURCES } from "@/game/types";

/** Allowed bank trades (amounts are per bank; multiply by bank count). */
const BASE_QUOTES: {
  from: ResourceKey;
  to: ResourceKey;
  pay: number;
  receive: number;
}[] = [
  { from: "wood", to: "stone", pay: BANK_EXCHANGE_AMOUNT, receive: BANK_EXCHANGE_AMOUNT },
  { from: "stone", to: "wood", pay: BANK_EXCHANGE_AMOUNT, receive: BANK_EXCHANGE_AMOUNT },
  { from: "wood", to: "coins", pay: BANK_EXCHANGE_AMOUNT, receive: BANK_EXCHANGE_AMOUNT / 2 },
  { from: "stone", to: "coins", pay: BANK_EXCHANGE_AMOUNT, receive: BANK_EXCHANGE_AMOUNT / 2 },
  { from: "coins", to: "wood", pay: BANK_EXCHANGE_AMOUNT / 2, receive: BANK_EXCHANGE_AMOUNT },
  { from: "coins", to: "stone", pay: BANK_EXCHANGE_AMOUNT / 2, receive: BANK_EXCHANGE_AMOUNT },
  { from: "coins", to: "research", pay: BANK_EXCHANGE_AMOUNT, receive: BANK_EXCHANGE_AMOUNT / 2 },
];

export function isBankEntity(e: PlacedEntity): boolean {
  if (e.stored) return false;
  if (e.definitionId === "landmark_bank") return true;
  return (
    e.definitionId === "project_site" &&
    e.appearance?.stage === "complete" &&
    e.appearance.projectType === "town_bank"
  );
}

export function countBanks(city: CityState): number {
  return city.entities.filter(isBankEntity).length;
}

export function bankQuote(
  from: ResourceKey,
  to: ResourceKey,
  bankCount: number
): { pay: number; receive: number; label: string } | null {
  if (bankCount <= 0 || from === to) return null;
  const base = BASE_QUOTES.find((q) => q.from === from && q.to === to);
  if (!base) return null;
  const pay = base.pay * bankCount;
  const receive = base.receive * bankCount;
  return {
    pay,
    receive,
    label: `${pay} ${from} → ${receive} ${to}`,
  };
}

export function allBankQuotes(bankCount: number): {
  from: ResourceKey;
  to: ResourceKey;
  pay: number;
  receive: number;
  label: string;
}[] {
  if (bankCount <= 0) return [];
  return BASE_QUOTES.map((q) => {
    const quote = bankQuote(q.from, q.to, bankCount)!;
    return { from: q.from, to: q.to, ...quote };
  });
}

export function bankCostGain(
  from: ResourceKey,
  to: ResourceKey,
  bankCount: number
): { cost: Resources; gain: Resources; pay: number; receive: number } | null {
  const quote = bankQuote(from, to, bankCount);
  if (!quote) return null;
  const cost: Resources = { ...ZERO_RESOURCES };
  const gain: Resources = { ...ZERO_RESOURCES };
  cost[from] = quote.pay;
  gain[to] = quote.receive;
  return { cost, gain, pay: quote.pay, receive: quote.receive };
}
