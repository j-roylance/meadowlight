"use client";

import { MapViewport } from "@/game/rendering/MapViewport";
import { GameProvider, useGame } from "./GameProvider";
import { AuthShell } from "./auth/AuthGate";
import { Hud } from "./Hud";
import { BuildDrawer } from "./BuildDrawer";
import { ExpansionScenes } from "./ExpansionScenes";
import {
  DemoPanel,
  ErrorToast,
  ExploreChip,
  Inspector,
  MapsPanel,
  MobileNav,
  Onboarding,
  ProjectsPanel,
  SendPanel,
  SettingsPanel,
} from "./Panels";

function GameInner() {
  const {
    city,
    loading,
    tool,
    buildDefId,
    ghost,
    roadDraft,
    selected,
    visiting,
    sceneView,
    handleTileClick,
    handleTileHover,
    handleEntityClick,
    reducedMotion,
    isMultiplayer,
  } = useGame();

  if (loading || !city) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="meadow-panel p-6 meadow-title text-2xl">Waking the meadow…</div>
      </div>
    );
  }

  const view = visiting ?? city;
  // Visiting a neighbour always shows their map; scenes belong to my own city.
  const inScene = sceneView.kind !== "city" && !visiting;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
      {/* Keep the map mounted (camera position survives) but inert while a scene is open. */}
      <div className="absolute inset-0" aria-hidden={inScene} inert={inScene}>
        <MapViewport
          city={view}
          readOnly={Boolean(visiting)}
          tool={tool}
          buildDefId={buildDefId ?? undefined}
          ghostValid={ghost.valid}
          ghostReason={ghost.reason}
          roadPreview={roadDraft}
          selectedEntityId={selected?.id}
          onTileClick={(x, y) => void handleTileClick(x, y)}
          onTileHover={handleTileHover}
          onEntityClick={handleEntityClick}
          reducedMotion={reducedMotion || inScene}
        />
      </div>
      {inScene && <ExpansionScenes />}
      <Hud />
      <BuildDrawer />
      <MapsPanel />
      <ProjectsPanel />
      <SettingsPanel />
      {!isMultiplayer && <DemoPanel />}
      <SendPanel />
      <Inspector />
      <ExploreChip />
      <Onboarding />
      <ErrorToast />
      <MobileNav />
      {city.economy.actionsRemaining === 0 && !visiting && !inScene && (
        <div className="pointer-events-none absolute bottom-28 left-1/2 z-10 hidden -translate-x-1/2 meadow-chip text-sm md:block">
          A calm stopping point — browse freely until the next window.
        </div>
      )}
    </div>
  );
}

export function GameShell() {
  return (
    <AuthShell>
      <GameProvider>
        <GameInner />
      </GameProvider>
    </AuthShell>
  );
}
