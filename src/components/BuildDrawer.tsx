"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  BUILDINGS,
  BUILDING_TIPS,
  HOUSE_STYLES,
  PROJECTS,
} from "@/game/catalog/definitions";
import { BuildingArt, RoadTileArt } from "@/game/rendering/buildings";
import type { BuildingDefId, ProjectDefId } from "@/game/types";
import { useGame } from "./GameProvider";
import { ResourceAmount, ResourceCostLine, ResourceIcon } from "./ResourceIcon";
import { ClickableHintIcon } from "./ClickableHint";

const TOWN = [
  "wood_workshop",
  "stone_yard",
  "neighborhood_market",
  "flower_garden",
  "pocket_park",
] as const;

/** Small isometric preview for build catalog rows. */
function BuildThumb({
  definitionId,
  projectType,
  stage,
  label,
}: {
  definitionId: string;
  projectType?: string;
  stage?: string;
  label: string;
}) {
  const def = BUILDINGS[definitionId];
  const w = def?.footprint.w ?? (projectType ? 4 : 1);
  const h = def?.footprint.h ?? (projectType ? 4 : 1);
  const span = Math.max(w, h);
  // Fit larger footprints; leave headroom for roofs/rockets above the diamond.
  const halfX = 36 * span + 12;
  const top = 28 * span + 36;
  const bottom = 28 * span + 24;
  return (
    <span
      className="relative inline-flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#e8f0d8]/60 ring-1 ring-[#6b9e4a]/25"
      aria-hidden
    >
      <svg
        width="52"
        height="52"
        viewBox={`${-halfX} ${-top} ${halfX * 2} ${top + bottom}`}
        className="pointer-events-none"
        role="img"
        aria-label={label}
      >
        <BuildingArt
          definitionId={definitionId}
          stage={stage}
          projectType={projectType}
        />
      </svg>
    </span>
  );
}

function RoadThumb() {
  return (
    <span
      className="relative inline-flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#e8f0d8]/60 ring-1 ring-[#6b9e4a]/25"
      aria-hidden
    >
      <svg width="52" height="52" viewBox="-40 -8 80 72" className="pointer-events-none">
        <RoadTileArt n e s w />
      </svg>
    </span>
  );
}

function CatalogRow({
  thumb,
  children,
  className = "",
  ...btn
}: {
  thumb: ReactNode;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...btn} className={`meadow-btn text-left ${className}`}>
      <span className="flex items-start gap-3">
        {thumb}
        <span className="min-w-0 flex-1">{children}</span>
      </span>
    </button>
  );
}

export function BuildDrawer() {
  const {
    panel,
    setPanel,
    setTool,
    setBuildDefId,
    buildDefId,
    tool,
    roadDraft,
    confirmRoad,
    setRoadDraft,
    setPortalDestinationId,
    portalDestinationId,
    directory,
    openMaps,
    beginProjectPlacement,
    pendingProjectId,
  } = useGame();

  if (panel !== "build") return null;

  const pick = (id: BuildingDefId) => {
    setBuildDefId(id);
    setTool("build");
  };

  return (
    <aside className="meadow-panel absolute bottom-0 right-0 top-24 z-30 flex w-full max-w-md flex-col overflow-auto p-4 md:rounded-l-2xl md:rounded-tr-none">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="meadow-title text-xl">Build</h2>
        <button type="button" className="meadow-btn" onClick={() => setPanel("city")}>
          Close
        </button>
      </div>

      <section className="mb-4">
        <h3 className="mb-2 font-bold">Houses</h3>
        <div className="grid gap-2">
          {HOUSE_STYLES.map((id) => {
            const def = BUILDINGS[id];
            const tip = BUILDING_TIPS[id];
            return (
              <CatalogRow
                key={id}
                title={tip}
                className={buildDefId === id && tool === "build" ? "ring-2 ring-[#6b9e4a]" : ""}
                onClick={() => pick(id)}
                thumb={<BuildThumb definitionId={id} label={def.name} />}
              >
                <div>{def.name}</div>
                {tip && <div className="text-[11px] opacity-60">{tip}</div>}
                <div className="text-xs font-medium opacity-80">
                  <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>1 action ·</span>
                    <ResourceCostLine amounts={def.cost} />
                    <span>· +</span>
                    <ResourceAmount resource="coins" amount={`${def.level1.yield.coins}/12h`} size="sm" />
                  </span>
                </div>
              </CatalogRow>
            );
          })}
        </div>
      </section>

      <section className="mb-4">
        <h3 className="mb-2 font-bold">Town buildings</h3>
        <div className="grid gap-2">
          {TOWN.map((id) => {
            const def = BUILDINGS[id];
            const y = def.level1.yield;
            const tip = BUILDING_TIPS[id];
            return (
              <CatalogRow
                key={id}
                title={tip}
                className={buildDefId === id && tool === "build" ? "ring-2 ring-[#6b9e4a]" : ""}
                onClick={() => pick(id)}
                thumb={<BuildThumb definitionId={id} label={def.name} />}
              >
                <div>{def.name}</div>
                {tip && <div className="text-[11px] opacity-60">{tip}</div>}
                <div className="text-xs font-medium opacity-80">
                  <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>1 action ·</span>
                    <ResourceCostLine amounts={def.cost} />
                    {(y.coins > 0 ||
                      y.wood > 0 ||
                      y.stone > 0 ||
                      y.research > 0 ||
                      y.happiness > 0) && (
                      <>
                        <span>· +</span>
                        <ResourceCostLine
                          amounts={{
                            coins: y.coins,
                            wood: y.wood,
                            stone: y.stone,
                            research: y.research,
                            happiness: y.happiness,
                          }}
                          suffix=" /12h"
                        />
                      </>
                    )}
                  </span>
                </div>
              </CatalogRow>
            );
          })}
        </div>
      </section>

      <section className="mb-4">
        <h3 className="mb-2 font-bold">Projects</h3>
        <p className="mb-2 text-xs opacity-70">
          Place like a building (1 action + coins). You can keep placing — as many
          active sites as you want. Click a site later to spend wood and stone
          toward completion (no action).
        </p>
        <div className="grid gap-2">
          {Object.values(PROJECTS).map((p) => (
            <CatalogRow
              key={p.id}
              title={p.description}
              className={
                pendingProjectId === p.id && tool === "project" ? "ring-2 ring-[#6b9e4a]" : ""
              }
              onClick={() => beginProjectPlacement(p.id as ProjectDefId)}
              thumb={
                <BuildThumb
                  definitionId="project_site"
                  stage="complete"
                  projectType={p.id}
                  label={p.name}
                />
              }
            >
              <div className="flex items-center gap-1.5">
                <span>{p.name}</span>
                {(p.id === "town_bank" ||
                  p.id === "community_university" ||
                  p.id === "space_center") && (
                  <span title="Has click actions when finished">
                    <ClickableHintIcon size={14} />
                  </span>
                )}
              </div>
              <div className="text-[11px] opacity-60">{p.description}</div>
              <div className="text-xs font-medium opacity-80">
                <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>Start: 1 action +</span>
                  <ResourceAmount resource="coins" amount={p.startCoins} size="sm" />
                  {p.startResearch > 0 && (
                    <>
                      <span>+</span>
                      <ResourceAmount resource="research" amount={p.startResearch} size="sm" />
                    </>
                  )}
                  <span>· then {p.workRequired}× (</span>
                  <ResourceAmount resource="wood" amount={p.workCost.wood} size="sm" />
                  <span>+</span>
                  <ResourceAmount resource="stone" amount={p.workCost.stone} size="sm" />
                  {p.workCost.research > 0 && (
                    <>
                      <span>+</span>
                      <ResourceAmount resource="research" amount={p.workCost.research} size="sm" />
                    </>
                  )}
                  <span>)</span>
                </span>
              </div>
            </CatalogRow>
          ))}
        </div>
      </section>

      <section className="mb-4">
        <h3 className="mb-2 font-bold">Roads</h3>
        <CatalogRow
          className={`w-full ${tool === "road" ? "ring-2 ring-[#6b9e4a]" : ""}`}
          thumb={<RoadThumb />}
          onClick={() => {
            setTool("road");
            setBuildDefId(null);
            setRoadDraft([]);
          }}
        >
          <span className="inline-flex flex-wrap items-center gap-1.5">
            Draw road (1–16 tiles, 1 <ResourceIcon resource="stone" size="sm" /> each new, 1
            action)
          </span>
        </CatalogRow>
        {tool === "road" && (
          <div className="mt-2 flex gap-2">
            <button type="button" className="meadow-btn meadow-btn-primary" onClick={() => void confirmRoad()}>
              Confirm ({roadDraft.length}/16)
            </button>
            <button type="button" className="meadow-btn" onClick={() => setRoadDraft([])}>
              Clear
            </button>
          </div>
        )}
        <CatalogRow
          className={`mt-2 w-full ${tool === "erase_road" ? "ring-2 ring-[#6b9e4a]" : ""}`}
          thumb={<RoadThumb />}
          onClick={() => setTool("erase_road")}
        >
          Erase roads (free, no refund)
        </CatalogRow>
      </section>

      <section className="mb-4">
        <h3 className="mb-2 font-bold">Portal</h3>
        <p className="mb-2 text-sm opacity-80">
          Place + assign destination = 1 action total. Pick a city, then tap a tile.
        </p>
        <CatalogRow
          className="mb-2 w-full"
          thumb={<BuildThumb definitionId="portal" label="Portal" />}
          onClick={() => void openMaps()}
        >
          Browse destinations
        </CatalogRow>
        {directory.length > 0 && (
          <select
            className="meadow-btn w-full"
            value={portalDestinationId ?? ""}
            onChange={(e) => {
              setPortalDestinationId(e.target.value || null);
              setTool("portal");
              setBuildDefId("portal");
            }}
            aria-label="Portal destination"
          >
            <option value="">Choose destination…</option>
            {directory.map((d) => (
              <option key={d.cityId} value={d.cityId}>
                {d.name} {d.simulated ? "(simulated)" : ""}
              </option>
            ))}
          </select>
        )}
      </section>

      <section>
        <h3 className="mb-2 font-bold">Other</h3>
        <button
          type="button"
          className="meadow-btn w-full"
          onClick={() => {
            setTool("inspect");
            setBuildDefId(null);
            setPanel("city");
          }}
        >
          Inspect / cancel
        </button>
      </section>
    </aside>
  );
}
