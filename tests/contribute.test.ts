import { describe, expect, it } from "vitest";
import { createLocalDemoService } from "@/game/adapters/localDemo";
import { getProject } from "@/game/catalog/definitions";

describe("project contribute (no action cost)", () => {
  it("contributes wood+stone with zero actions remaining", async () => {
    const svc = createLocalDemoService();
    await svc.demoReset?.();
    let city = (await svc.syncMyCity()).city!;
    const project = city.projects.find((p) => p.status !== "complete");
    expect(project).toBeTruthy();
    const pdef = getProject(project!.definitionId);

    // Burn both actions
    city = (
      await svc.takeSupplyRun({
        requestId: "burn-1",
        expectedRevision: city.revision,
        resource: "coins",
      })
    ).city!;
    city = (
      await svc.takeSupplyRun({
        requestId: "burn-2",
        expectedRevision: city.revision,
        resource: "coins",
      })
    ).city!;
    expect(city.economy.actionsRemaining).toBe(0);

    const beforeWood = city.economy.wood;
    const beforeStone = city.economy.stone;
    const beforeWork = project!.workCurrent;

    const res = await svc.contributeToOwnProject({
      requestId: "contrib-0-actions",
      expectedRevision: city.revision,
      projectId: project!.id,
    });

    expect(res.ok).toBe(true);
    expect(res.city!.economy.actionsRemaining).toBe(0);
    expect(res.city!.economy.wood).toBe(beforeWood - pdef.workCost.wood);
    expect(res.city!.economy.stone).toBe(beforeStone - pdef.workCost.stone);
    const updated = res.city!.projects.find((p) => p.id === project!.id)!;
    expect(updated.workCurrent).toBe(beforeWork + 1);
  });

  it("remote project work also spends no action", async () => {
    const svc = createLocalDemoService();
    await svc.demoReset?.();
    let city = (await svc.syncMyCity()).city!;
    const maps = await svc.listPlayerMaps();
    const destId = maps.data!.entries[0].cityId;

    const portalRes = await svc.createAssignedPortal({
      requestId: "portal-work",
      expectedRevision: city.revision,
      x: 5n,
      y: 0n,
      destinationCityId: destId,
    });
    expect(portalRes.ok).toBe(true);
    city = portalRes.city!;
    const portal = city.portals[0];

    // Spend remaining action
    city = (
      await svc.takeSupplyRun({
        requestId: "burn-last",
        expectedRevision: city.revision,
        resource: "coins",
      })
    ).city!;
    expect(city.economy.actionsRemaining).toBe(0);

    const dest = (await svc.readCitySummary(destId)).city!;
    const remoteProject = dest.projects.find((p) => p.status !== "complete");
    expect(remoteProject).toBeTruthy();

    const res = await svc.sendProjectWork({
      requestId: "remote-work-0",
      expectedRevision: city.revision,
      portalEntityId: portal.entityId,
      expectedAssignmentRevision: portal.assignmentRevision,
      destinationCityId: destId,
      projectId: remoteProject!.id,
    });
    expect(res.ok).toBe(true);
    expect(res.city!.economy.actionsRemaining).toBe(0);
  });
});
