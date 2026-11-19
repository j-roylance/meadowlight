import { describe, expect, it } from "vitest";
import { createLocalDemoService } from "@/game/adapters/localDemo";
import { nextBuildingRotation, rotatedFootprintSize } from "@/game/simulation/coords";

describe("building rotation", () => {
  it("cycles 90° steps and swaps non-square footprint dims", () => {
    expect(nextBuildingRotation(0, 1)).toBe(90);
    expect(nextBuildingRotation(270, 1)).toBe(0);
    expect(nextBuildingRotation(0, -1)).toBe(270);
    expect(rotatedFootprintSize(2, 1, 0)).toEqual({ w: 2, h: 1 });
    expect(rotatedFootprintSize(2, 1, 90)).toEqual({ w: 1, h: 2 });
    expect(rotatedFootprintSize(2, 1, 180)).toEqual({ w: 2, h: 1 });
  });

  it("rotateBuilding turns a placed cottage free of charge", async () => {
    const svc = createLocalDemoService();
    await svc.demoReset?.();
    let city = (await svc.syncMyCity()).city!;
    const cottage = city.entities.find((e) => e.definitionId.startsWith("cottage_"));
    expect(cottage).toBeTruthy();
    expect(cottage!.rotation).toBe(0);
    const actionsBefore = city.economy.actionsRemaining;

    const res = await svc.rotateBuilding({
      requestId: "rot-1",
      expectedRevision: city.revision,
      entityId: cottage!.id,
      direction: 1,
    });
    expect(res.ok, res.error).toBe(true);
    city = res.city!;
    const updated = city.entities.find((e) => e.id === cottage!.id)!;
    expect(updated.rotation).toBe(90);
    expect(city.economy.actionsRemaining).toBe(actionsBefore);

    const left = await svc.rotateBuilding({
      requestId: "rot-2",
      expectedRevision: city.revision,
      entityId: cottage!.id,
      direction: -1,
    });
    expect(left.ok, left.error).toBe(true);
    expect(left.city!.entities.find((e) => e.id === cottage!.id)!.rotation).toBe(0);
  });
});
