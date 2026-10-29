"use client";

import { useGame } from "./GameProvider";
import { populationAndAmenity } from "@/game/simulation/economy";
import { isDemoMapName } from "@/game/demoMap";
import { ResourceAmount } from "./ResourceIcon";

export function Hud() {
  const {
    city,
    nextWindowLabel,
    setPanel,
    openMaps,
    visiting,
    returnHome,
    sceneView,
    returnToCity,
    isMultiplayer,
  } = useGame();
  const inScene = sceneView.kind !== "city" && !visiting;
  if (!city) return null;
  const view = visiting ?? city;
  const { population, amenity } = populationAndAmenity(view);
  const e = city.economy;
  const demoMap = !isMultiplayer && isDemoMapName(city.name);

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3">
      <div className="pointer-events-auto flex flex-wrap items-start justify-between gap-2">
        <div className="meadow-panel px-3 py-2">
          <div className="meadow-title text-lg leading-tight">{view.name}</div>
          <div className="text-xs opacity-70">
            {visiting ? `Visiting · ${view.displayName}` : view.displayName}
          </div>
          <div className="mt-1 flex flex-wrap gap-3 text-sm font-bold">
            <ResourceAmount resource="coins" amount={visiting ? "—" : e.coins} />
            <ResourceAmount resource="wood" amount={visiting ? "—" : e.wood} />
            <ResourceAmount resource="stone" amount={visiting ? "—" : e.stone} />
            <ResourceAmount resource="research" amount={visiting ? "—" : e.research} />
            <ResourceAmount resource="happiness" amount={visiting ? "—" : e.happiness} />
            {!visiting && (
              <span className="rounded-full bg-[#8fbf6a]/30 px-2">
                {e.actionsRemaining}/2 actions
              </span>
            )}
          </div>
          {!visiting && e.actionsRemaining === 0 && (
            <div className="mt-1 text-xs opacity-80">
              Next window in {nextWindowLabel}
            </div>
          )}
          <div className="mt-1 text-xs opacity-60">
            Pop {population} · Amenity {amenity}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {demoMap && (
            <div className="meadow-chip text-xs font-bold text-amber-950">
              Demo map — simulated neighbors
            </div>
          )}
          <nav className="flex flex-wrap justify-end gap-2">
            {visiting ? (
              <button type="button" className="meadow-btn meadow-btn-primary" onClick={() => void returnHome()}>
                Return to my city
              </button>
            ) : (
              <>
                {inScene ? (
                  <button
                    type="button"
                    className="meadow-btn meadow-btn-primary"
                    onClick={() => returnToCity()}
                  >
                    Back to city
                  </button>
                ) : (
                  <button type="button" className="meadow-btn" onClick={() => setPanel("build")}>
                    Build
                  </button>
                )}
                <button type="button" className="meadow-btn" onClick={() => void openMaps()}>
                  Maps
                </button>
                <button type="button" className="meadow-btn" onClick={() => setPanel("projects")}>
                  Projects
                </button>
                <button type="button" className="meadow-btn" onClick={() => setPanel("settings")}>
                  Settings
                </button>
                {demoMap && (
                  <button type="button" className="meadow-btn meadow-btn-clay" onClick={() => setPanel("demo")}>
                    Demo tools
                  </button>
                )}
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
