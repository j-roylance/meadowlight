import { describe, expect, it } from "vitest";
import { parseState, stringifyState } from "@/game/engine/serialize";
import { createStarterCity } from "@/game/simulation/starter";
import { migrateCity, makeNeighbors } from "@/game/engine/worldService";

describe("snapshot serialize", () => {
  it("round-trips city state with bigints", () => {
    const city = createStarterCity({
      id: "c1",
      ownerId: "o1",
      name: "Test",
      displayName: "Tester",
      specialty: "markets",
      now: 1_700_000_000_000,
      seed: 42,
    });
    const raw = stringifyState(city);
    const back = migrateCity(parseState(raw));
    expect(back.id).toBe("c1");
    expect(back.entities[0].x).toBe(0n);
    expect(back.arrivalX).toBe(city.arrivalX);
    expect(back.economy.coins).toBe(city.economy.coins);
  });

  it("world service factory serves local demo neighbors when named demo", async () => {
    const { createWorldService } = await import("@/game/engine/worldService");
    let memory = {
      player: createStarterCity({
        id: "local-player",
        ownerId: "local-owner",
        name: "demo",
        displayName: "Demo",
        specialty: "markets" as const,
        now: Date.now(),
        seed: 1,
      }),
      neighbors: makeNeighbors(Date.now()),
      clockOffsetMs: 0,
      receipts: {},
      commerce: [] as { a: string; b: string; count: number; specA: string; specB: string }[],
    };
    memory.player.onboardingComplete = true;
    const svc = createWorldService({
      mode: "local_demo",
      modeLabel: "test",
      persistence: {
        load: () => memory,
        save: (s) => {
          memory = s;
        },
      },
      createInitialStore: () => memory,
      directoryMode: "demo_gated",
      enableDemoTools: true,
    });
    const maps = await svc.listPlayerMaps();
    expect(maps.data!.entries.length).toBeGreaterThan(0);
  });
});
