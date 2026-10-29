import { describe, expect, it, beforeEach } from "vitest";
import { createLocalDemoService } from "@/game/adapters/localDemo";

describe("portal-gated sends (local demo engine)", () => {
  beforeEach(() => {
    // jsdom/localStorage may be absent in node — adapter guards window
  });

  it("create assigned portal spends one action", async () => {
    // Exercise pure path via in-memory by monkeypatching storage absence:
    // Service creates fresh store when window is undefined after ensure —
    // In node, loadStore returns null and ensure creates new each call unless we keep reference.
    const svc = createLocalDemoService();
    // Without window, each ensure() creates new store — still same in-memory `store` variable.
    const sync = await svc.syncMyCity();
    expect(sync.city?.economy.actionsRemaining).toBe(2);
    await svc.completeOnboarding({ name: "demo", specialty: "markets" });
    const maps = await svc.listPlayerMaps();
    expect(maps.data!.entries.length).toBeGreaterThan(0);
    const dest = maps.data!.entries[0].cityId;
    const city = (await svc.syncMyCity()).city!;
    const res = await svc.createAssignedPortal({
      requestId: "portal-1",
      expectedRevision: city.revision,
      x: 5n,
      y: 0n,
      destinationCityId: dest,
    });
    expect(res.ok).toBe(true);
    expect(res.city!.economy.actionsRemaining).toBe(1);
    expect(res.city!.portals).toHaveLength(1);
    expect(res.city!.portals[0].destinationCityId).toBe(dest);
  });

  it("same request id is idempotent", async () => {
    const svc = createLocalDemoService();
    await svc.demoReset?.();
    const city = (await svc.syncMyCity()).city!;
    const maps = await svc.listPlayerMaps();
    const dest = maps.data!.entries[0].cityId;
    const a = await svc.createAssignedPortal({
      requestId: "same",
      expectedRevision: city.revision,
      x: 5n,
      y: 0n,
      destinationCityId: dest,
    });
    const b = await svc.createAssignedPortal({
      requestId: "same",
      expectedRevision: city.revision,
      x: 5n,
      y: 0n,
      destinationCityId: dest,
    });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(b.city!.economy.actionsRemaining).toBe(a.city!.economy.actionsRemaining);
  });

  it("resource parcel requires matching portal destination", async () => {
    const svc = createLocalDemoService();
    await svc.demoReset?.();
    let city = (await svc.syncMyCity()).city!;
    const maps = await svc.listPlayerMaps();
    const dest = maps.data!.entries[0].cityId;
    const other = maps.data!.entries[1].cityId;
    const placed = await svc.createAssignedPortal({
      requestId: "p2",
      expectedRevision: city.revision,
      x: 5n,
      y: 0n,
      destinationCityId: dest,
    });
    city = placed.city!;
    const portal = city.portals[0];
    const bad = await svc.sendResourceParcel({
      requestId: "bad-send",
      expectedRevision: city.revision,
      portalEntityId: portal.entityId,
      expectedAssignmentRevision: portal.assignmentRevision,
      destinationCityId: other,
      amounts: { coins: 1, wood: 0, stone: 0, research: 0 , happiness: 0 },
    });
    expect(bad.ok).toBe(false);
    expect(bad.city!.economy.actionsRemaining).toBe(city.economy.actionsRemaining);
  });
});
