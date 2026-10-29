import { describe, expect, it } from "vitest";
import { settleActionWindow, spendAction } from "@/game/simulation/actions";
import { WINDOW_MS, type EconomyState } from "@/game/types";

function eco(partial: Partial<EconomyState> = {}): EconomyState {
  return {
    coins: 80,
    wood: 60,
    stone: 40,
    research: 0,
    happiness: 0,
    remCoins: 0,
    remWood: 0,
    remStone: 0,
    remResearch: 0,
    remHappiness: 0,
    rateCoins: 26,
    rateWood: 14,
    rateStone: 14,
    rateResearch: 0,
    rateHappiness: 0,
    lastSettledAt: 0,
    actionsRemaining: 2,
    actionWindowStartAt: 0,
    ...partial,
  };
}

describe("action windows — no banking", () => {
  it("fresh city has exactly 2 actions", () => {
    expect(eco().actionsRemaining).toBe(2);
  });

  it("spending both leaves zero until next window", () => {
    let e = eco();
    e = spendAction(e);
    e = spendAction(e);
    expect(e.actionsRemaining).toBe(0);
    e = settleActionWindow(e, WINDOW_MS - 1);
    expect(e.actionsRemaining).toBe(0);
    e = settleActionWindow(e, WINDOW_MS);
    expect(e.actionsRemaining).toBe(2);
  });

  it("unused action does not carry over — boundary yields exactly 2", () => {
    let e = eco({ actionsRemaining: 1 });
    e = settleActionWindow(e, WINDOW_MS);
    expect(e.actionsRemaining).toBe(2);
  });

  it("72 hours absence still yields only 2", () => {
    let e = eco({ actionsRemaining: 0 });
    e = settleActionWindow(e, WINDOW_MS * 6);
    expect(e.actionsRemaining).toBe(2);
    expect(e.actionWindowStartAt).toBe(WINDOW_MS * 6);
  });

  it("spending does not shift the window anchor", () => {
    let e = eco({ actionWindowStartAt: 1000 });
    e = spendAction(e);
    expect(e.actionWindowStartAt).toBe(1000);
  });
});
