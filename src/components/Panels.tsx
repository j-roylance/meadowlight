"use client";

import { useEffect, useState } from "react";
import {
  BUILDING_TIPS,
  getBuilding,
  tryGetProject,
} from "@/game/catalog/definitions";
import { isPortableGift } from "@/game/catalog/expansion";
import { isDemoMapName } from "@/game/demoMap";
import { projectStage } from "@/game/simulation/projects";
import { allBankQuotes, countBanks, isBankEntity } from "@/game/simulation/bank";
import { isSpaceCenterEntity } from "@/game/simulation/spaceCenter";
import {
  EXPEDITION_DECISIONS,
  EXPLORATION_HAPPINESS_COST,
  FOUNDING_LAUNCH_COST,
} from "@/game/catalog/expansion";
import { useGame } from "./GameProvider";
import { ClickableHintIcon } from "./ClickableHint";
import {
  ResourceAmount,
  ResourceCostLine,
  ResourceExchangeLabel,
  ResourceIcon,
} from "./ResourceIcon";

export function MapsPanel() {
  const {
    panel,
    setPanel,
    directory,
    visitCity,
    setPortalDestinationId,
    setTool,
    setBuildDefId,
    setPanel: setP,
    isMultiplayer,
  } = useGame();
  const [q, setQ] = useState("");
  if (panel !== "maps") return null;
  const filtered = directory.filter(
    (d) =>
      !q ||
      d.name.toLowerCase().includes(q.toLowerCase()) ||
      d.displayName.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <aside className="meadow-panel absolute bottom-0 right-0 top-24 z-30 flex w-full max-w-md flex-col overflow-auto p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="meadow-title text-xl">Maps</h2>
        <button type="button" className="meadow-btn" onClick={() => setPanel("city")}>
          Close
        </button>
      </div>
      <p className="mb-2 text-sm opacity-80">
        Free read-only visits. Cross-city changes need a portal on your map.
      </p>
      <input
        className="meadow-btn mb-3 w-full text-left"
        placeholder="Search cities…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search maps"
      />
      <ul className="flex flex-col gap-2">
        {filtered.map((d) => (
          <li key={d.cityId} className="meadow-panel p-3">
            <div className="font-bold">
              {d.name}{" "}
              {d.simulated && (
                <span className="text-xs font-semibold text-amber-800">(simulated)</span>
              )}
            </div>
            <div className="text-xs opacity-70">
              {d.displayName} · {d.specialty} · {d.projectStatus}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="meadow-btn meadow-btn-primary"
                onClick={() => void visitCity(d.cityId)}
              >
                Visit
              </button>
              <button
                type="button"
                className="meadow-btn"
                onClick={() => {
                  setPortalDestinationId(d.cityId);
                  setBuildDefId("portal");
                  setTool("portal");
                  setP("build");
                }}
              >
                Portal here
              </button>
            </div>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="text-sm opacity-70">
            {isMultiplayer
              ? "No other players yet. Invite a friend to create a city, then refresh Maps."
              : (
                <>
                  No maps match. Name your city <strong>demo</strong> to unlock simulated neighbors
                  and demo tools.
                </>
              )}
          </li>
        )}
      </ul>
    </aside>
  );
}

export function ProjectsPanel() {
  const {
    panel,
    setPanel,
    city,
    contributeOwn,
    demoSimWork,
    cancelUntouched,
  } = useGame();
  if (panel !== "projects" || !city) return null;

  return (
    <aside className="meadow-panel absolute bottom-0 right-0 top-24 z-30 flex w-full max-w-md flex-col overflow-auto p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="meadow-title text-xl">Projects</h2>
        <button type="button" className="meadow-btn" onClick={() => setPanel("city")}>
          Close
        </button>
      </div>
      <p className="mb-3 text-sm opacity-80">
        Place new sites from Build (action + coins). Click a site to contribute wood
        and stone — no action cost. You can host as many as you want.
      </p>
      {city.projects.length === 0 && (
        <p className="text-sm opacity-70">No projects yet — open Build → Projects.</p>
      )}
      {city.projects.map((p) => {
        const def = tryGetProject(p.definitionId);
        const stage = projectStage(p);
        if (!def) {
          return (
            <div key={p.id} className="meadow-panel mb-3 p-3">
              <div className="font-bold opacity-70">Unavailable project</div>
              <div className="text-xs opacity-60">{p.definitionId}</div>
            </div>
          );
        }
        return (
          <div key={p.id} className="meadow-panel mb-3 p-3">
            <div className="font-bold">{def.name}</div>
            <div className="text-sm">
              {p.workCurrent}/{def.workRequired} work · {stage.label}
            </div>
            <div className="mt-1 text-xs opacity-70">{def.description}</div>
            {p.contributors.length > 0 && (
              <ul className="mt-2 text-xs">
                {p.contributors.map((c) => (
                  <li key={c.cityId}>
                    {c.cityName}: {c.work} work
                  </li>
                ))}
              </ul>
            )}
            {p.status !== "complete" && (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="meadow-btn meadow-btn-primary"
                  onClick={() => void contributeOwn(p.id)}
                >
                  <span className="inline-flex items-center gap-1.5">
                    Contribute (
                    <ResourceAmount resource="wood" amount={def.workCost.wood} size="sm" />
                    +
                    <ResourceAmount resource="stone" amount={def.workCost.stone} size="sm" />
                    {def.workCost.research > 0 && (
                      <>
                        +
                        <ResourceAmount resource="research" amount={def.workCost.research} size="sm" />
                      </>
                    )}
                    )
                  </span>
                </button>
                {p.workCurrent === 0 && (
                  <button
                    type="button"
                    className="meadow-btn"
                    onClick={() => void cancelUntouched(p.id)}
                  >
                    Cancel (refund coins)
                  </button>
                )}
                {isDemoMapName(city.name) && (
                  <button
                    type="button"
                    className="meadow-btn meadow-btn-clay"
                    onClick={() => void demoSimWork(p.id)}
                  >
                    Demo: simulated help
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}

export function SettingsPanel() {
  const {
    panel,
    setPanel,
    city,
    supplyRun,
    reducedMotion,
    setReducedMotion,
    visiting,
    enterExpedition,
    enterHome,
    enterBackyard,
    enterStation,
    renameCity,
    isMultiplayer,
    accountEmail,
    signOut,
  } = useGame();
  const [nameDraft, setNameDraft] = useState("");
  useEffect(() => {
    if (panel === "settings" && city) setNameDraft(city.name);
  }, [panel, city?.name, city]);
  if (panel !== "settings" || !city) return null;
  const hasHome = Boolean(
    city.expansion.primaryHomeEntityId &&
      city.expansion.homes[city.expansion.primaryHomeEntityId]
  );
  const hasStation = city.expansion.spaceCenters.some((s) => s.stationId);
  const activeExp = city.expansion.activeExpedition;
  const resumable = activeExp && (activeExp.status === "active" || activeExp.status === "paused");

  return (
    <aside className="meadow-panel absolute bottom-0 right-0 top-24 z-30 flex w-full max-w-md flex-col overflow-auto p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="meadow-title text-xl">Settings</h2>
        <button type="button" className="meadow-btn" onClick={() => setPanel("city")}>
          Close
        </button>
      </div>
      <p className="mb-2 text-sm">
        <strong>Two actions per twelve-hour window. Unused actions do not carry over.</strong>
      </p>
      <p className="mb-4 text-sm opacity-80">Specialty: {city.specialty}.</p>
      <label className="mb-2 block text-sm font-bold">
        City name
        <input
          className="meadow-btn mt-1 w-full text-left"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          aria-label="City name"
        />
      </label>
      <button
        type="button"
        className="meadow-btn mb-4"
        disabled={nameDraft.trim() === city.name || !nameDraft.trim()}
        onClick={() => void renameCity(nameDraft.trim())}
      >
        Save name
      </button>
      {isMultiplayer ? (
        <div className="mb-4 text-xs opacity-70">
          <p className="mb-2">
            Signed in{accountEmail ? ` as ${accountEmail}` : ""}. Your city is saved to your
            account.
          </p>
          <button type="button" className="meadow-btn" onClick={() => void signOut()}>
            Log out
          </button>
        </div>
      ) : (
        <p className="mb-4 text-xs opacity-70">
          {isDemoMapName(city.name)
            ? "Demo map — simulated neighbors and demo tools are unlocked."
            : "Name your city “demo” (then Save name) to unlock demo tools and simulated neighbors."}
        </p>
      )}
      <label className="mb-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={reducedMotion}
          onChange={(e) => setReducedMotion(e.target.checked)}
        />
        Reduced motion
      </label>
      <p className="mb-3 text-sm opacity-80">
        Click a tree or stone pile on the map to harvest (1 action · +25 wood or
        stone). Wood Workshop and Stone Yard add wood and stone every 12h
        automatically.
      </p>
      <h3 className="mb-2 font-bold">Supply run (1 action)</h3>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="meadow-btn" onClick={() => void supplyRun("coins")}>
          <span className="inline-flex items-center gap-1">
            +30 <ResourceIcon resource="coins" size="sm" />
          </span>
        </button>
        <button type="button" className="meadow-btn" onClick={() => void supplyRun("wood")}>
          <span className="inline-flex items-center gap-1">
            +20 <ResourceIcon resource="wood" size="sm" />
          </span>
        </button>
        <button type="button" className="meadow-btn" onClick={() => void supplyRun("stone")}>
          <span className="inline-flex items-center gap-1">
            +20 <ResourceIcon resource="stone" size="sm" />
          </span>
        </button>
        <button type="button" className="meadow-btn" onClick={() => void supplyRun("research")}>
          <span className="inline-flex items-center gap-1">
            +20 <ResourceIcon resource="research" size="sm" />
          </span>
        </button>
      </div>
      {!visiting && (
        <>
          <h3 className="mb-2 mt-5 font-bold">Home, orbit &amp; exploration</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="meadow-btn meadow-btn-primary"
              onClick={() => enterExpedition()}
            >
              <span className="inline-flex flex-wrap items-center gap-1.5">
                {resumable ? "Resume outing" : "Explore"}
                {!resumable && (
                  <span className="text-xs font-medium opacity-80">
                    · 1 action + <ResourceAmount resource="happiness" amount={EXPLORATION_HAPPINESS_COST} size="sm" />
                  </span>
                )}
              </span>
            </button>
            {hasHome && (
              <>
                <button type="button" className="meadow-btn" onClick={() => enterHome()}>
                  Enter home
                </button>
                <button type="button" className="meadow-btn" onClick={() => enterBackyard()}>
                  Enter backyard
                </button>
              </>
            )}
            {hasStation && (
              <button type="button" className="meadow-btn" onClick={() => enterStation()}>
                Enter station
              </button>
            )}
          </div>
          {!hasHome && (
            <p className="mt-2 text-xs opacity-70">
              Select a cottage on the map and choose “Designate as home” (free) to unlock your
              interior and backyard.
            </p>
          )}
        </>
      )}
      <details className="mt-6 text-sm opacity-80" open>
        <summary>Expansion is available</summary>
        <p className="mt-2">
          Home interiors, backyard gardens, a Space Center with an orbital station, and short
          exploration outings are now part of Meadowlight. They share the same two-action window;
          designating a home and rearranging furniture are free.
        </p>
      </details>
    </aside>
  );
}

export function DemoPanel() {
  const {
    panel,
    setPanel,
    demoAdvance,
    demoReset,
    demoGrantResources,
    demoFillResources,
    city,
  } = useGame();
  if (panel !== "demo" || !city || !isDemoMapName(city.name)) return null;

  return (
    <aside className="meadow-panel absolute bottom-0 right-0 top-24 z-30 flex w-full max-w-md flex-col overflow-auto border-2 border-amber-600/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="meadow-title text-xl text-amber-900">Demo tools</h2>
        <button type="button" className="meadow-btn" onClick={() => setPanel("city")}>
          Close
        </button>
      </div>
      <p className="mb-3 rounded-lg bg-amber-100 p-2 text-sm text-amber-950">
        Local demo only — simulated neighbors and clock overrides. These never affect a live
        multiplayer economy.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="meadow-btn meadow-btn-clay" onClick={() => void demoAdvance(12)}>
          Advance 12 hours
        </button>
        <button type="button" className="meadow-btn meadow-btn-clay" onClick={() => void demoAdvance(24)}>
          Advance 24 hours
        </button>
        <button type="button" className="meadow-btn" onClick={() => void demoReset()}>
          Reset demo city
        </button>
      </div>
      <h3 className="mb-2 mt-4 font-bold text-amber-950">Resources</h3>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="meadow-btn meadow-btn-clay"
          onClick={() => void demoGrantResources(100)}
        >
          <span className="inline-flex flex-wrap items-center gap-1">
            +100 all
            <ResourceIcon resource="coins" size="sm" />
            <ResourceIcon resource="wood" size="sm" />
            <ResourceIcon resource="stone" size="sm" />
            <ResourceIcon resource="research" size="sm" />
            <ResourceIcon resource="happiness" size="sm" />
          </span>
        </button>
        <button
          type="button"
          className="meadow-btn meadow-btn-clay"
          onClick={() => void demoFillResources(99_999)}
        >
          Set all to 99,999 (demo infinite)
        </button>
      </div>
      {city && (
        <p className="mt-3 text-xs opacity-70">
          Actions: {city.economy.actionsRemaining}/2 · Window start offset applied in demo clock
        </p>
      )}
    </aside>
  );
}

export function Inspector() {
  const {
    selected,
    setSelected,
    city,
    upgradeSelected,
    storeSelected,
    bankExchange,
    setPanel,
    visiting,
    contributeOwn,
    cancelUntouched,
    designateHome,
    enterHome,
    enterBackyard,
    enterStation,
    foundingLaunch,
  } = useGame();
  if (!selected || !city || visiting) return null;
  const portal = city.portals.find((p) => p.entityId === selected.id);
  const isCottage =
    selected.definitionId === "cottage_a" ||
    selected.definitionId === "cottage_b" ||
    selected.definitionId === "cottage_c";
  const isPrimaryHome = city.expansion.primaryHomeEntityId === selected.id;
  const homeBinding = isCottage ? city.expansion.homes[selected.id] : undefined;
  const hosted =
    selected.definitionId === "project_site"
      ? city.projects.find((p) => p.entityId === selected.id)
      : undefined;
  const projectDef = hosted ? tryGetProject(hosted.definitionId) : null;
  const buildingDef =
    selected.definitionId !== "project_site" ? getBuilding(selected.definitionId) : null;
  const isBank = isBankEntity(selected);
  const isSpaceCenter = isSpaceCenterEntity(selected);
  const spaceCenter = isSpaceCenter
    ? city.expansion.spaceCenters.find((s) => s.entityId === selected.id)
    : undefined;
  const stationFounded = Boolean(spaceCenter?.stationId);
  const spaceCenterComplete =
    isSpaceCenter ||
    (hosted?.definitionId === "space_center" && hosted.status === "complete");
  const bankCount = isBank ? countBanks(city) : 0;
  const bankQuotes = isBank ? allBankQuotes(bankCount) : [];

  return (
    <div className="meadow-panel absolute bottom-20 left-3 z-20 max-w-sm p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 font-bold">
            {projectDef?.name ?? buildingDef?.name ?? selected.definitionId.replaceAll("_", " ")}
            {(isBank ||
              spaceCenterComplete ||
              portal ||
              (hosted && hosted.status !== "complete")) && (
              <ClickableHintIcon size={14} title="Has click actions" />
            )}
          </div>
          <div className="text-xs opacity-70">
            {hosted && projectDef && hosted.status !== "complete"
              ? `${hosted.workCurrent}/${projectDef.workRequired} work · ${projectStage(hosted).label}`
              : spaceCenterComplete
                ? stationFounded
                  ? "Operational — enter station or plan launches"
                  : "Finished — founding launch available"
              : isBank
                ? `${bankCount} bank${bankCount === 1 ? "" : "s"} · click to exchange (1 action)`
                : portal
                  ? "Click Send to move resources or project work"
                  : `Level ${selected.level} · tile ${selected.x.toString()},${selected.y.toString()}${isPrimaryHome ? " · Your home" : ""}`}
          </div>
          {(projectDef?.description ||
            (buildingDef && BUILDING_TIPS[buildingDef.id])) && (
            <div className="mt-1 text-[11px] opacity-70">
              {projectDef?.description ?? BUILDING_TIPS[buildingDef!.id]}
            </div>
          )}
        </div>
        <button type="button" className="meadow-btn" onClick={() => setSelected(null)}>
          ✕
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {hosted && projectDef && hosted.status !== "complete" && (
          <button
            type="button"
            className="meadow-btn meadow-btn-primary"
            onClick={() => void contributeOwn(hosted.id)}
          >
            <span className="inline-flex flex-wrap items-center gap-1.5">
              Contribute (
              <ResourceAmount resource="wood" amount={projectDef.workCost.wood} size="sm" />
              +
              <ResourceAmount resource="stone" amount={projectDef.workCost.stone} size="sm" />
              {projectDef.workCost.research > 0 && (
                <>
                  +
                  <ResourceAmount
                    resource="research"
                    amount={projectDef.workCost.research}
                    size="sm"
                  />
                </>
              )}
              · no action)
            </span>
          </button>
        )}
        {hosted && hosted.workCurrent === 0 && hosted.status !== "complete" && (
          <button
            type="button"
            className="meadow-btn"
            onClick={() => void cancelUntouched(hosted.id)}
          >
            Cancel (refund coins)
          </button>
        )}
        {isBank &&
          bankQuotes.map((pair) => (
            <button
              key={`${pair.from}-${pair.to}`}
              type="button"
              className="meadow-btn meadow-btn-primary"
              onClick={() =>
                void bankExchange(
                  pair.from as "coins" | "wood" | "stone" | "research",
                  pair.to as "coins" | "wood" | "stone" | "research"
                )
              }
            >
              <ResourceExchangeLabel
                from={pair.from}
                to={pair.to}
                pay={pair.pay}
                receive={pair.receive}
              />
            </button>
          ))}
        {isCottage && !isPrimaryHome && (
          <button
            type="button"
            className="meadow-btn meadow-btn-primary"
            onClick={() => void designateHome(selected.id)}
          >
            Designate as home (0 actions)
          </button>
        )}
        {isCottage && homeBinding && (
          <>
            <button
              type="button"
              className="meadow-btn meadow-btn-primary"
              onClick={() => enterHome(selected.id)}
            >
              Enter home
            </button>
            <button
              type="button"
              className="meadow-btn"
              onClick={() => enterBackyard(selected.id)}
            >
              Enter backyard
            </button>
          </>
        )}
        {spaceCenterComplete && !stationFounded && (
          <button
            type="button"
            className="meadow-btn meadow-btn-primary"
            onClick={() => void foundingLaunch(selected.id)}
          >
            <span className="inline-flex flex-wrap items-center gap-1.5">
              Founding launch
              <span className="text-xs font-medium opacity-80">
                · 1 action + <ResourceCostLine amounts={FOUNDING_LAUNCH_COST} />
              </span>
            </span>
          </button>
        )}
        {spaceCenterComplete && stationFounded && (
          <button
            type="button"
            className="meadow-btn meadow-btn-primary"
            onClick={() => enterStation(selected.id)}
          >
            Enter station
          </button>
        )}
        {buildingDef?.upgradeable && selected.level === 1 && (
          <button type="button" className="meadow-btn meadow-btn-primary" onClick={() => void upgradeSelected()}>
            Upgrade (1 action)
          </button>
        )}
        {selected.definitionId !== "town_hall" &&
          selected.definitionId !== "project_site" && (
          <button type="button" className="meadow-btn" onClick={() => void storeSelected()}>
            Store (free)
          </button>
        )}
        {portal && (
          <button type="button" className="meadow-btn meadow-btn-primary" onClick={() => setPanel("send")}>
            Send through portal
          </button>
        )}
      </div>
      {portal && (
        <p className="mt-2 text-xs opacity-80">
          Destination: {portal.destinationCityId} · rev {portal.assignmentRevision}
        </p>
      )}
    </div>
  );
}

export function SendPanel() {
  const { panel, setPanel, selected, city, sendParcel, sendWork, sendPortableGift, directory } =
    useGame();
  const [coins, setCoins] = useState(5);
  const [wood, setWood] = useState(0);
  const [stone, setStone] = useState(0);
  const [research, setResearch] = useState(0);
  const [happiness, setHappiness] = useState(0);
  if (panel !== "send" || !city || !selected) return null;
  const portal = city.portals.find((p) => p.entityId === selected.id);
  if (!portal) return null;
  const dest = directory.find((d) => d.cityId === portal.destinationCityId);
  const giftable = city.expansion.inventory.filter(
    (i) => !i.bedState && isPortableGift(i.definitionId)
  );

  return (
    <aside className="meadow-panel absolute bottom-0 right-0 top-24 z-30 flex w-full max-w-md flex-col overflow-auto p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="meadow-title text-xl">Send</h2>
        <button type="button" className="meadow-btn" onClick={() => setPanel("city")}>
          Close
        </button>
      </div>
      <p className="mb-3 text-sm">
        Through your portal → {dest?.name ?? portal.destinationCityId}
        {dest?.simulated ? " (simulated)" : ""}
      </p>
      <h3 className="font-bold">Resource parcel (1 action)</h3>
      <div className="my-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="text-sm">
          <span className="inline-flex items-center gap-1">
            <ResourceIcon resource="coins" size="sm" /> Coins
          </span>
          <input
            type="number"
            min={0}
            className="meadow-btn mt-1 w-full"
            value={coins}
            onChange={(e) => setCoins(Number(e.target.value))}
          />
        </label>
        <label className="text-sm">
          <span className="inline-flex items-center gap-1">
            <ResourceIcon resource="wood" size="sm" /> Wood
          </span>
          <input
            type="number"
            min={0}
            className="meadow-btn mt-1 w-full"
            value={wood}
            onChange={(e) => setWood(Number(e.target.value))}
          />
        </label>
        <label className="text-sm">
          <span className="inline-flex items-center gap-1">
            <ResourceIcon resource="stone" size="sm" /> Stone
          </span>
          <input
            type="number"
            min={0}
            className="meadow-btn mt-1 w-full"
            value={stone}
            onChange={(e) => setStone(Number(e.target.value))}
          />
        </label>
        <label className="text-sm">
          <span className="inline-flex items-center gap-1">
            <ResourceIcon resource="research" size="sm" /> Research
          </span>
          <input
            type="number"
            min={0}
            className="meadow-btn mt-1 w-full"
            value={research}
            onChange={(e) => setResearch(Number(e.target.value))}
          />
        </label>
        <label className="text-sm">
          <span className="inline-flex items-center gap-1">
            <ResourceIcon resource="happiness" size="sm" /> Happiness
          </span>
          <input
            type="number"
            min={0}
            className="meadow-btn mt-1 w-full"
            value={happiness}
            onChange={(e) => setHappiness(Number(e.target.value))}
          />
        </label>
      </div>
      <button
        type="button"
        className="meadow-btn meadow-btn-primary mb-4"
        onClick={() => void sendParcel({ coins, wood, stone, research, happiness })}
      >
        Send parcel
      </button>
      <h3 className="mb-2 font-bold">Portable gift (1 action)</h3>
      <p className="mb-2 text-xs opacity-70">
        Send stored decor or harvests. Growing beds, homes, and station gear cannot be gifted.
      </p>
      <div className="mb-4 flex max-h-40 flex-col gap-1 overflow-auto">
        {giftable.length === 0 && (
          <p className="text-xs opacity-60">No giftable inventory items.</p>
        )}
        {giftable.map((item) => (
          <button
            key={item.id}
            type="button"
            className="meadow-btn text-left text-sm"
            onClick={() => void sendPortableGift(item.id)}
          >
            Gift {item.definitionId.replaceAll("_", " ")}
            {item.quantity > 1 ? ` ×${item.quantity}` : ""}
          </button>
        ))}
      </div>
      <h3 className="font-bold inline-flex items-center gap-1.5">
        Project work (
        <ResourceIcon resource="wood" size="sm" />
        +
        <ResourceIcon resource="stone" size="sm" />
        only — no action)
      </h3>
      <p className="mb-2 text-xs opacity-70">
        In demo, open Maps → Visit a neighbor, note their project, or contribute on your own board.
        Remote work needs the destination project ID from a visited city.
      </p>
      <NeighborWorkButtons destinationId={portal.destinationCityId} onSend={(id) => void sendWork(id)} />
    </aside>
  );
}

function NeighborWorkButtons({
  destinationId,
  onSend,
}: {
  destinationId: string;
  onSend: (projectId: string) => void;
}) {
  const { service } = useGame();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    void service.readCitySummary(destinationId).then((res) => {
      if (cancelled || !res.city) return;
      setProjects(
        res.city.projects
          .filter((p) => p.status !== "complete")
          .map((p) => {
            const def = tryGetProject(p.definitionId);
            return {
              id: p.id,
              name: def?.name ?? "Unavailable project",
            };
          })
          .filter((p) => p.name !== "Unavailable project")
      );
    });
    return () => {
      cancelled = true;
    };
  }, [destinationId, service]);

  return (
    <div className="flex flex-col gap-2">
      {projects.map((p) => (
        <button key={p.id} type="button" className="meadow-btn" onClick={() => onSend(p.id)}>
          Work on {p.name}
        </button>
      ))}
      {projects.length === 0 && (
        <p className="text-sm opacity-70">No open projects at destination.</p>
      )}
    </div>
  );
}

export function Onboarding() {
  const { city, completeOnboarding, isMultiplayer } = useGame();
  const [name, setName] = useState("Sunny Meadow");
  const [specialty, setSpecialty] = useState<"markets" | "wood" | "stone">("markets");
  if (!city || city.onboardingComplete) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#3a3020]/35 p-4 backdrop-blur-sm">
      <div className="meadow-panel max-w-md p-6">
        <h1 className="meadow-title mb-2 text-3xl">Meadowlight</h1>
        <p className="mb-4 text-sm leading-relaxed opacity-90">
          A cozy place you tend a little each day.{" "}
          <strong>
            Two actions per twelve-hour window. Unused actions do not carry over.
          </strong>
        </p>
        <label className="mb-3 block text-sm font-bold">
          City name
          <input
            className="meadow-btn mt-1 w-full text-left"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="mb-4 block text-sm font-bold">
          Specialty (portal commerce)
          <select
            className="meadow-btn mt-1 w-full"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value as typeof specialty)}
          >
            <option value="markets">Markets (coins)</option>
            <option value="wood">Wood</option>
            <option value="stone">Stone</option>
          </select>
        </label>
        <button
          type="button"
          className="meadow-btn meadow-btn-primary w-full"
          onClick={() => void completeOnboarding(name || "Meadowlight", specialty)}
        >
          Enter my meadow
        </button>
        <p className="mt-3 text-xs opacity-70">
          Tip: try building a cottage and a short road with your first two actions.
          {isMultiplayer
            ? " Your city is saved to your account."
            : (
              <>
                {" "}
                Name the city <strong>demo</strong> if you want demo tools and simulated neighbors.
              </>
            )}
        </p>
      </div>
    </div>
  );
}

export function ErrorToast() {
  const { error } = useGame();
  if (!error) return null;
  return (
    <div
      role="status"
      className="meadow-chip absolute bottom-24 left-1/2 z-40 max-w-[90%] -translate-x-1/2 bg-red-100 text-red-950"
    >
      {error}
    </div>
  );
}

/** Small always-reachable entry point to exploration (city view, nothing selected). */
export function ExploreChip() {
  const { city, selected, visiting, sceneView, enterExpedition } = useGame();
  if (!city || !city.onboardingComplete || visiting || selected) return null;
  if (sceneView.kind !== "city") return null;
  const exp = city.expansion.activeExpedition;
  const resumable = exp && (exp.status === "active" || exp.status === "paused");
  return (
    <button
      type="button"
      className="meadow-btn meadow-btn-primary absolute bottom-20 left-3 z-20"
      onClick={() => enterExpedition()}
      aria-label={resumable ? "Resume exploration outing" : "Explore beyond the meadow"}
    >
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <span aria-hidden>🧭</span>
        {resumable ? `Resume outing ${exp.stepIndex}/${EXPEDITION_DECISIONS}` : "Explore"}
        {!resumable && (
          <span className="inline-flex items-center gap-1 text-xs font-medium opacity-80">
            · 1 action +
            <ResourceAmount resource="happiness" amount={EXPLORATION_HAPPINESS_COST} size="sm" />
          </span>
        )}
      </span>
    </button>
  );
}

export function MobileNav() {
  const { setPanel, openMaps, visiting, returnToCity } = useGame();
  if (visiting) return null;
  return (
    <nav className="meadow-panel absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-2 p-2 md:hidden">
      <button
        type="button"
        className="meadow-btn"
        onClick={() => {
          setPanel("city");
          returnToCity();
        }}
      >
        City
      </button>
      <button type="button" className="meadow-btn" onClick={() => void openMaps()}>
        Maps
      </button>
      <button type="button" className="meadow-btn" onClick={() => setPanel("projects")}>
        Projects
      </button>
    </nav>
  );
}
