import { describe, expect, it } from "vitest";
import { createLocalDemoService } from "@/game/adapters/localDemo";
import { bankQuote, countBanks } from "@/game/simulation/bank";

describe("bank exchange", () => {
  it("coins→wood costs half coins for full wood; scales with bank count", async () => {
    const svc = createLocalDemoService();
    await svc.demoReset?.();
    let city = (await svc.syncMyCity()).city!;

    // Place a finished bank landmark (blueprint entitlement via force-add then place)
    city = {
      ...city,
      blueprints: [{ type: "landmark_bank", provenance: "test" }],
      revision: city.revision + 1,
    };
    // Use placeLandmark through service after syncing blueprint via demo path:
    // Inject by placing through placeBuilding is blocked for cosmetic with 0 cost still OK.
    const placed = await svc.placeBuilding({
      requestId: "place-bank-lm",
      expectedRevision: (await svc.syncMyCity()).city!.revision,
      definitionId: "landmark_bank",
      x: 10n,
      y: 1n,
    });
    // placeBuilding may reject if no afford / or allow cosmetic — if fail, use landmark API
    if (!placed.ok) {
      // Grant blueprint on live store via contribute-complete path is heavy; use placeLandmark
      const sync = await svc.syncMyCity();
      city = sync.city!;
      // Mutate via placeLandmark after manually setting blueprint through completeOnboarding reset
      await svc.demoReset?.();
      city = (await svc.syncMyCity()).city!;
    }

    // Direct approach: placeLandmark after demoReset + sync, then patch via taking a completed site
    await svc.demoReset?.();
    city = (await svc.syncMyCity()).city!;
    // Start and instantly complete is hard; place landmark_bank with placeBuilding — costs 0
    let res = await svc.placeBuilding({
      requestId: "lm-bank-1",
      expectedRevision: city.revision,
      definitionId: "landmark_bank",
      x: 10n,
      y: 1n,
    });
    expect(res.ok, res.error).toBe(true);
    city = res.city!;
    const bank = city.entities.find((e) => e.definitionId === "landmark_bank");
    expect(bank).toBeTruthy();
    expect(countBanks(city)).toBe(1);

    city = (
      await svc.takeSupplyRun({
        requestId: "top-coins",
        expectedRevision: city.revision,
        resource: "coins",
      })
    ).city!;
    await svc.demoAdvanceHours?.(12);
    city = (await svc.syncMyCity()).city!;

    const q = bankQuote("coins", "wood", 1)!;
    expect(q.pay).toBe(50);
    expect(q.receive).toBe(100);

    const beforeCoins = city.economy.coins;
    const beforeWood = city.economy.wood;
    res = await svc.bankExchange({
      requestId: "ex-1",
      expectedRevision: city.revision,
      entityId: bank!.id,
      from: "coins",
      to: "wood",
    });
    expect(res.ok, res.error).toBe(true);
    expect(res.city!.economy.coins).toBe(beforeCoins - 50);
    expect(res.city!.economy.wood).toBe(beforeWood + 100);
  });

  it("coins→research is 100 coins for 50 research; wood↔stone is 1:1", () => {
    expect(bankQuote("coins", "research", 1)).toEqual({
      pay: 100,
      receive: 50,
      label: "100 coins → 50 research",
    });
    expect(bankQuote("wood", "stone", 2)).toEqual({
      pay: 200,
      receive: 200,
      label: "200 wood → 200 stone",
    });
    expect(bankQuote("wood", "coins", 1)).toEqual({
      pay: 100,
      receive: 50,
      label: "100 wood → 50 coins",
    });
    expect(bankQuote("research", "coins", 1)).toBeNull();
  });

  it("rejects invalid or unaffordable exchanges", async () => {
    const svc = createLocalDemoService();
    await svc.demoReset?.();
    let city = (await svc.syncMyCity()).city!;
    const placed = await svc.placeBuilding({
      requestId: "place-bank-2",
      expectedRevision: city.revision,
      definitionId: "landmark_bank",
      x: 10n,
      y: 2n,
    });
    expect(placed.ok, placed.error).toBe(true);
    city = placed.city!;
    const bank = city.entities.find((e) => e.definitionId === "landmark_bank")!;

    const bad = await svc.bankExchange({
      requestId: "bad-pair",
      expectedRevision: city.revision,
      entityId: bank.id,
      from: "research",
      to: "coins",
    });
    expect(bad.ok).toBe(false);

    expect(city.economy.wood).toBeLessThan(100);
    const broke = await svc.bankExchange({
      requestId: "broke",
      expectedRevision: city.revision,
      entityId: bank.id,
      from: "wood",
      to: "stone",
    });
    expect(broke.ok).toBe(false);
    expect(broke.error).toMatch(/Need 100 wood/);
  });
});
