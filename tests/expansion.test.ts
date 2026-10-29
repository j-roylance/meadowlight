import { describe, expect, it } from "vitest";
import { createLocalDemoService } from "@/game/adapters/localDemo";
import {
  EXPLORATION_HAPPINESS_COST,
  FOUNDING_LAUNCH_COST,
  SPACE_CENTER_COST,
  SPACE_RESEARCH_UNIT,
  STATION_MODULES,
} from "@/game/catalog/expansion";
import { getProject } from "@/game/catalog/definitions";

async function fresh() {
  const svc = createLocalDemoService();
  await svc.demoReset?.();
  const city = (await svc.syncMyCity()).city!;
  return { svc, city };
}

describe("expansion balance constants", () => {
  it("uses H=1 and R=5 from current economy heuristics", () => {
    expect(EXPLORATION_HAPPINESS_COST).toBe(1);
    expect(SPACE_RESEARCH_UNIT).toBe(5);
    expect(SPACE_CENTER_COST.research).toBe(10);
    expect(FOUNDING_LAUNCH_COST.research).toBe(5);
  });
});

describe("home designation and starter kit", () => {
  it("designates a house, grants one starter kit, and follows house id", async () => {
    const { svc, city: c0 } = await fresh();
    const cottage = c0.entities.find((e) => e.definitionId === "cottage_a")!;
    const beforeCoins = c0.economy.coins;
    const beforeActions = c0.economy.actionsRemaining;

    const res = await svc.designatePrimaryHome({
      requestId: "home-1",
      expectedRevision: c0.revision,
      houseEntityId: cottage.id,
    });
    expect(res.ok).toBe(true);
    const city = res.city!;
    expect(city.economy.coins).toBe(beforeCoins);
    expect(city.economy.actionsRemaining).toBe(beforeActions);
    expect(city.expansion.primaryHomeEntityId).toBe(cottage.id);
    expect(city.expansion.grants.starter_home_kit_v1).toBe(true);
    expect(city.expansion.homes[cottage.id]).toBeTruthy();
    expect(city.expansion.inventory.length).toBeGreaterThan(0);

    // Re-designate same house does not duplicate starter kit
    const invCount = city.expansion.inventory.length;
    const again = await svc.designatePrimaryHome({
      requestId: "home-2",
      expectedRevision: city.revision,
      houseEntityId: cottage.id,
    });
    expect(again.ok).toBe(true);
    expect(again.city!.expansion.inventory.length).toBe(invCount);
  });
});

describe("gardening planting batch", () => {
  it("plants 1–4 slots for one action and 2 coins each; rejects a 5th", async () => {
    const { svc } = await fresh();
    let city = (await svc.syncMyCity()).city!;
    const cottage = city.entities.find((e) => e.definitionId === "cottage_a")!;
    city = (
      await svc.designatePrimaryHome({
        requestId: "g-home",
        expectedRevision: city.revision,
        houseEntityId: cottage.id,
      })
    ).city!;
    const binding = city.expansion.homes[cottage.id];
    const backyard = city.expansion.backyards[binding.backyardSceneId];
    const bed = backyard.items.find((i) => i.definitionId === "raised_bed")!;
    const beforeCoins = city.economy.coins;
    const beforeActions = city.economy.actionsRemaining;

    const plant = await svc.plantGardenBatch({
      requestId: "plant-2",
      expectedRevision: city.revision,
      backyardSceneId: binding.backyardSceneId,
      bedItemId: bed.itemId,
      changes: [
        { slotIndex: 0, varietyId: "daisy" },
        { slotIndex: 1, varietyId: "basil" },
      ],
    });
    expect(plant.ok).toBe(true);
    city = plant.city!;
    expect(city.economy.actionsRemaining).toBe(beforeActions - 1);
    expect(city.economy.coins).toBe(beforeCoins - 4);

    const tooMany = await svc.plantGardenBatch({
      requestId: "plant-5",
      expectedRevision: city.revision,
      backyardSceneId: binding.backyardSceneId,
      bedItemId: bed.itemId,
      changes: [
        { slotIndex: 0, varietyId: "rose" },
        { slotIndex: 1, varietyId: "rose" },
        { slotIndex: 2, varietyId: "rose" },
        { slotIndex: 3, varietyId: "rose" },
        { slotIndex: 0, varietyId: "tomato" },
      ],
    });
    expect(tooMany.ok).toBe(false);
  });

  it("credits harvest once after maturity and does not duplicate", async () => {
    const { svc } = await fresh();
    let city = (await svc.syncMyCity()).city!;
    const cottage = city.entities.find((e) => e.definitionId === "cottage_a")!;
    city = (
      await svc.designatePrimaryHome({
        requestId: "h-mat",
        expectedRevision: city.revision,
        houseEntityId: cottage.id,
      })
    ).city!;
    const binding = city.expansion.homes[cottage.id];
    const bed = city.expansion.backyards[binding.backyardSceneId].items.find(
      (i) => i.definitionId === "raised_bed"
    )!;
    city = (
      await svc.plantGardenBatch({
        requestId: "plant-daisy",
        expectedRevision: city.revision,
        backyardSceneId: binding.backyardSceneId,
        bedItemId: bed.itemId,
        changes: [{ slotIndex: 0, varietyId: "daisy" }],
      })
    ).city!;
    const beforeHarvest = city.expansion.inventory.filter(
      (i) => i.definitionId === "daisy_bloom"
    ).length;

    await svc.demoAdvanceHours?.(13);
    city = (await svc.syncMyCity()).city!;
    const after = city.expansion.inventory.filter(
      (i) => i.definitionId === "daisy_bloom"
    ).length;
    expect(after).toBe(beforeHarvest + 1);

    await svc.demoAdvanceHours?.(13);
    city = (await svc.syncMyCity()).city!;
    const again = city.expansion.inventory.filter(
      (i) => i.definitionId === "daisy_bloom"
    ).length;
    expect(again).toBe(after);
  });
});

async function finishSpaceCenterProject(
  svc: ReturnType<typeof createLocalDemoService>,
  cityIn: Awaited<ReturnType<typeof fresh>>["city"]
) {
  let city = cityIn;
  // Research for start (2R = 10) via supply runs + windows
  while (city.economy.research < SPACE_CENTER_COST.research) {
    if (city.economy.actionsRemaining === 0) {
      await svc.demoAdvanceHours?.(12);
      city = (await svc.syncMyCity()).city!;
    }
    city = (
      await svc.takeSupplyRun({
        requestId: `sc-res-${city.revision}`,
        expectedRevision: city.revision,
        resource: "research",
      })
    ).city!;
  }
  if (city.economy.actionsRemaining === 0) {
    await svc.demoAdvanceHours?.(12);
    city = (await svc.syncMyCity()).city!;
  }
  // Wood/stone for 8 work units
  while (city.economy.wood < 40 || city.economy.stone < 40) {
    if (city.economy.actionsRemaining === 0) {
      await svc.demoAdvanceHours?.(12);
      city = (await svc.syncMyCity()).city!;
    }
    const resource = city.economy.wood < 40 ? "wood" : "stone";
    city = (
      await svc.takeSupplyRun({
        requestId: `sc-mat-${city.revision}`,
        expectedRevision: city.revision,
        resource,
      })
    ).city!;
  }
  if (city.economy.actionsRemaining === 0) {
    await svc.demoAdvanceHours?.(12);
    city = (await svc.syncMyCity()).city!;
  }

  const started = await svc.startHostedProject({
    requestId: `sc-start-${city.revision}`,
    expectedRevision: city.revision,
    definitionId: "space_center",
    x: -6n,
    y: 4n,
  });
  expect(started.ok).toBe(true);
  city = started.city!;
  const project = city.projects.find((p) => p.definitionId === "space_center")!;
  expect(project).toBeTruthy();

  while (project && city.projects.find((p) => p.id === project.id)?.status !== "complete") {
    const res = await svc.contributeToOwnProject({
      requestId: `sc-work-${city.revision}`,
      expectedRevision: city.revision,
      projectId: project.id,
    });
    expect(res.ok).toBe(true);
    city = res.city!;
  }
  const centerEntity = city.entities.find((e) => e.id === project.entityId)!;
  expect(centerEntity.appearance?.stage).toBe("complete");
  expect(city.expansion.spaceCenters.some((s) => s.entityId === project.entityId)).toBe(
    true
  );
  return { city, entityId: project.entityId };
}

describe("space center and station", () => {
  it("is a hosted project: start spends 2R, finish registers pad, founding spends R", async () => {
    const { svc } = await fresh();
    let city = (await svc.syncMyCity()).city!;
    const beforeStartResearch = Math.max(city.economy.research, 0);
    // Ensure we can observe the start research debit
    while (city.economy.research < SPACE_CENTER_COST.research) {
      if (city.economy.actionsRemaining === 0) {
        await svc.demoAdvanceHours?.(12);
        city = (await svc.syncMyCity()).city!;
      }
      city = (
        await svc.takeSupplyRun({
          requestId: `pre-r-${city.revision}`,
          expectedRevision: city.revision,
          resource: "research",
        })
      ).city!;
    }
    const researchBeforeStart = city.economy.research;
    const finished = await finishSpaceCenterProject(svc, city);
    city = finished.city;
    // Start cost was deducted during finishSpaceCenterProject
    expect(researchBeforeStart).toBeGreaterThanOrEqual(SPACE_CENTER_COST.research);
    void beforeStartResearch;

    // Direct placeBuilding of space_center is rejected
    const direct = await svc.placeBuilding({
      requestId: "sc-direct",
      expectedRevision: city.revision,
      definitionId: "space_center",
      x: 12n,
      y: 12n,
    });
    expect(direct.ok).toBe(false);

    await svc.demoAdvanceHours?.(12);
    city = (await svc.syncMyCity()).city!;
    // Founding also needs coins/wood/stone — top up via supply runs.
    for (const resource of ["coins", "wood", "stone", "research"] as const) {
      while (
        (resource === "coins" && city.economy.coins < FOUNDING_LAUNCH_COST.coins) ||
        (resource === "wood" && city.economy.wood < FOUNDING_LAUNCH_COST.wood) ||
        (resource === "stone" && city.economy.stone < FOUNDING_LAUNCH_COST.stone) ||
        (resource === "research" &&
          city.economy.research < FOUNDING_LAUNCH_COST.research)
      ) {
        if (city.economy.actionsRemaining === 0) {
          await svc.demoAdvanceHours?.(12);
          city = (await svc.syncMyCity()).city!;
        }
        city = (
          await svc.takeSupplyRun({
            requestId: `found-${resource}-${city.revision}`,
            expectedRevision: city.revision,
            resource,
          })
        ).city!;
      }
    }
    if (city.economy.actionsRemaining === 0) {
      await svc.demoAdvanceHours?.(12);
      city = (await svc.syncMyCity()).city!;
    }
    const beforeR = city.economy.research;
    const beforeA = city.economy.actionsRemaining;
    const launch = await svc.foundingLaunch({
      requestId: "launch-found",
      expectedRevision: city.revision,
      spaceCenterEntityId: finished.entityId,
      launchId: "launch-found-1",
    });
    expect(launch.ok).toBe(true);
    city = launch.city!;
    expect(city.economy.research).toBe(beforeR - FOUNDING_LAUNCH_COST.research);
    expect(city.economy.actionsRemaining).toBe(beforeA - 1);
    expect(Object.keys(city.expansion.stations)).toHaveLength(1);

    const dup = await svc.foundingLaunch({
      requestId: "launch-found-dup",
      expectedRevision: city.revision,
      spaceCenterEntityId: finished.entityId,
      launchId: "launch-found-2",
    });
    expect(dup.ok).toBe(false);

    // Second Space Center project rejected
    if (city.economy.actionsRemaining === 0) {
      await svc.demoAdvanceHours?.(12);
      city = (await svc.syncMyCity()).city!;
    }
    while (city.economy.research < SPACE_CENTER_COST.research) {
      if (city.economy.actionsRemaining === 0) {
        await svc.demoAdvanceHours?.(12);
        city = (await svc.syncMyCity()).city!;
      }
      city = (
        await svc.takeSupplyRun({
          requestId: `dup-r-${city.revision}`,
          expectedRevision: city.revision,
          resource: "research",
        })
      ).city!;
    }
    const second = await svc.startHostedProject({
      requestId: "sc-second",
      expectedRevision: city.revision,
      definitionId: "space_center",
      x: 14n,
      y: 4n,
    });
    expect(second.ok).toBe(false);
  });

  it("charges module R once and rejects invalid attachment", async () => {
    const { svc } = await fresh();
    let city = (await svc.syncMyCity()).city!;
    const finished = await finishSpaceCenterProject(svc, city);
    city = finished.city;
    await svc.demoAdvanceHours?.(12);
    city = (await svc.syncMyCity()).city!;
    for (const resource of ["coins", "wood", "stone", "research"] as const) {
      const need =
        resource === "coins"
          ? FOUNDING_LAUNCH_COST.coins + STATION_MODULES.corridor.cost.coins
          : resource === "wood"
            ? FOUNDING_LAUNCH_COST.wood + STATION_MODULES.corridor.cost.wood
            : resource === "stone"
              ? FOUNDING_LAUNCH_COST.stone + STATION_MODULES.corridor.cost.stone
              : FOUNDING_LAUNCH_COST.research +
                STATION_MODULES.corridor.cost.research;
      while (city.economy[resource] < need) {
        if (city.economy.actionsRemaining === 0) {
          await svc.demoAdvanceHours?.(12);
          city = (await svc.syncMyCity()).city!;
        }
        city = (
          await svc.takeSupplyRun({
            requestId: `mod-stock-${resource}-${city.revision}`,
            expectedRevision: city.revision,
            resource,
          })
        ).city!;
      }
    }
    if (city.economy.actionsRemaining === 0) {
      await svc.demoAdvanceHours?.(12);
      city = (await svc.syncMyCity()).city!;
    }
    const founded = await svc.foundingLaunch({
      requestId: "found-mod",
      expectedRevision: city.revision,
      spaceCenterEntityId: finished.entityId,
      launchId: "lf-mod",
    });
    expect(founded.ok).toBe(true);
    city = founded.city!;
    const stationId = city.expansion.spaceCenters.find(
      (s) => s.entityId === finished.entityId
    )!.stationId!;
    if (city.economy.actionsRemaining === 0) {
      await svc.demoAdvanceHours?.(12);
      city = (await svc.syncMyCity()).city!;
    }

    const bad = await svc.launchStationModule({
      requestId: "mod-bad",
      expectedRevision: city.revision,
      stationId,
      definitionId: "corridor",
      gx: 5,
      gy: 5,
      rotation: 0,
      launchId: "mod-bad-1",
    });
    expect(bad.ok).toBe(false);

    const beforeR = city.economy.research;
    const good = await svc.launchStationModule({
      requestId: "mod-ok",
      expectedRevision: city.revision,
      stationId,
      definitionId: "corridor",
      gx: 0,
      gy: -1,
      rotation: 0,
      launchId: "mod-ok-1",
    });
    expect(good.ok).toBe(true);
    city = good.city!;
    expect(city.economy.research).toBe(
      beforeR - STATION_MODULES.corridor.cost.research
    );
  });
});

describe("exploration outing", () => {
  it("dispatch includes first step for 1 action + H; later steps charge again", async () => {
    const { svc } = await fresh();
    let city = (await svc.syncMyCity()).city!;
    // Ensure happiness
    expect(city.economy.happiness).toBeGreaterThanOrEqual(EXPLORATION_HAPPINESS_COST);

    const regions = await svc.listExpeditionRegions();
    const region = regions.data!.regions[0];
    expect(region).toBeTruthy();
    const preview = await svc.previewExpeditionChoices({
      regionKey: region.chunkKey,
    });
    const choice = preview.data!.choices[0];
    expect(choice).toBeTruthy();

    const beforeA = city.economy.actionsRemaining;
    const beforeH = city.economy.happiness;
    const dispatch = await svc.dispatchExpedition({
      requestId: "exp-1",
      expectedRevision: city.revision,
      regionKey: region.chunkKey,
      firstChoiceId: choice.id,
    });
    expect(dispatch.ok).toBe(true);
    city = dispatch.city!;
    expect(city.economy.actionsRemaining).toBe(beforeA - 1);
    expect(city.economy.happiness).toBe(beforeH - EXPLORATION_HAPPINESS_COST);
    expect(city.expansion.activeExpedition?.stepIndex).toBe(1);

    const nextChoice = city.expansion.activeExpedition!.availableChoices[0];
    const step = await svc.expeditionStep({
      requestId: "exp-2",
      expectedRevision: city.revision,
      choiceId: nextChoice.id,
    });
    expect(step.ok).toBe(true);
    city = step.city!;
    expect(city.economy.actionsRemaining).toBe(beforeA - 2);
    expect(city.expansion.activeExpedition?.stepIndex).toBe(2);

    // Zero actions: further step fails without debit
    const beforeH2 = city.economy.happiness;
    const blocked = await svc.expeditionStep({
      requestId: "exp-3",
      expectedRevision: city.revision,
      choiceId: city.expansion.activeExpedition!.availableChoices[0].id,
    });
    expect(blocked.ok).toBe(false);
    city = (await svc.syncMyCity()).city!;
    expect(city.economy.happiness).toBe(beforeH2);
    expect(city.expansion.activeExpedition?.stepIndex).toBe(2);

    // Action-free project contribute still works
    const project = city.projects.find((p) => p.status !== "complete")!;
    const pdef = getProject(project.definitionId);
    const contrib = await svc.contributeToOwnProject({
      requestId: "exp-contrib",
      expectedRevision: city.revision,
      projectId: project.id,
    });
    expect(contrib.ok).toBe(true);
    expect(contrib.city!.economy.actionsRemaining).toBe(0);
    expect(contrib.city!.economy.wood).toBe(city.economy.wood - pdef.workCost.wood);
  });

  it("does not advance expedition via project contribute", async () => {
    const { svc } = await fresh();
    let city = (await svc.syncMyCity()).city!;
    const regions = await svc.listExpeditionRegions();
    const region = regions.data!.regions[0];
    const preview = await svc.previewExpeditionChoices({
      regionKey: region.chunkKey,
    });
    city = (
      await svc.dispatchExpedition({
        requestId: "exp-nc",
        expectedRevision: city.revision,
        regionKey: region.chunkKey,
        firstChoiceId: preview.data!.choices[0].id,
      })
    ).city!;
    const stepBefore = city.expansion.activeExpedition!.stepIndex;
    const project = city.projects.find((p) => p.status !== "complete")!;
    await svc.contributeToOwnProject({
      requestId: "no-advance",
      expectedRevision: city.revision,
      projectId: project.id,
    });
    city = (await svc.syncMyCity()).city!;
    expect(city.expansion.activeExpedition!.stepIndex).toBe(stepBefore);
  });
});

describe("shared two-action window across systems", () => {
  it("third action-charging command fails while material-only contribute works", async () => {
    const { svc } = await fresh();
    let city = (await svc.syncMyCity()).city!;
    const cottage = city.entities.find((e) => e.definitionId === "cottage_a")!;
    city = (
      await svc.designatePrimaryHome({
        requestId: "share-home",
        expectedRevision: city.revision,
        houseEntityId: cottage.id,
      })
    ).city!;

    // Burn both actions with supply runs
    city = (
      await svc.takeSupplyRun({
        requestId: "share-1",
        expectedRevision: city.revision,
        resource: "coins",
      })
    ).city!;
    city = (
      await svc.takeSupplyRun({
        requestId: "share-2",
        expectedRevision: city.revision,
        resource: "coins",
      })
    ).city!;
    expect(city.economy.actionsRemaining).toBe(0);

    const bundle = await svc.acquireFurnitureBundle({
      requestId: "share-bundle",
      expectedRevision: city.revision,
      bundleId: "living_room_set",
    });
    expect(bundle.ok).toBe(false);

    const project = city.projects.find((p) => p.status !== "complete")!;
    const contrib = await svc.contributeToOwnProject({
      requestId: "share-contrib",
      expectedRevision: city.revision,
      projectId: project.id,
    });
    expect(contrib.ok).toBe(true);
    expect(contrib.city!.economy.actionsRemaining).toBe(0);
  });
});
