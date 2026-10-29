"use client";

/**
 * Meadowlight expansion scenes — a playable overlay rendered by GameShell when
 * `sceneView.kind !== "city"`:
 *
 *   1. Home interior cutaway   (8×8 plan of rooms, furniture from inventory)
 *   2. Backyard                (12×12, raised-bed planting UI)
 *   3. Station orbital view    (module launch + instrument install)
 *   4. Expedition              (7×7 encounter map, choice confirmation)
 *
 * Rules of thumb used throughout:
 *   - Free ops (place / move / store / rotate / recall) act immediately.
 *   - Paid ops always go through a touch-friendly confirm sheet that spells out
 *     "N action + cost" with the existing resource icons.
 *   - Launch animation is skipped entirely when `reducedMotion` is on.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ENCOUNTER_TEMPLATES,
  EXPEDITION_DECISIONS,
  EXPEDITION_MAP_SIZE,
  EXPLORATION_HAPPINESS_COST,
  FURNITURE_BUNDLES,
  GARDEN_BED_COST,
  INSTRUMENTS,
  PLANTS,
  PLANT_SLOT_COIN_COST,
  ROOM_ADD_COST,
  SPACE_RESEARCH_UNIT,
  STATION_MODULES,
  getFurniture,
  type BiomeFamily,
  type FurnitureDefId,
  type InstrumentDefId,
  type PlantVarietyId,
  type StationModuleDefId,
} from "@/game/catalog/expansion";
import { formatDuration } from "@/game/simulation/actions";
import { canAfford } from "@/game/simulation/economy";
import {
  footprintTiles,
  validateBackyardPlacement,
  validateInteriorPlacement,
} from "@/game/simulation/home";
import {
  canStoreModule,
  modulePorts,
  placedModules,
  stationPower,
  validateModuleAttachment,
} from "@/game/simulation/space";
import {
  ZERO_RESOURCES,
  type ExpeditionChoice,
  type ExpeditionInstance,
  type ExpeditionRegion,
  type GardenPlot,
  type InventoryItem,
  type ResourceKey,
  type Resources,
  type SceneItemPlacement,
  type StationModule,
} from "@/game/types";
import { useGame } from "./GameProvider";
import { ResourceAmount, ResourceCostLine } from "./ResourceIcon";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

type Rotation = 0 | 90 | 180 | 270;
type CostMap = Partial<Record<ResourceKey, number>>;

const RESOURCE_KEYS: ResourceKey[] = ["coins", "wood", "stone", "research", "happiness"];

const nextRotation = (r: Rotation): Rotation => ((r + 90) % 360) as Rotation;

function toResources(partial?: CostMap): Resources {
  const out: Resources = { ...ZERO_RESOURCES };
  if (partial) for (const k of RESOURCE_KEYS) out[k] = partial[k] ?? 0;
  return out;
}

function rotatedSize(w: number, h: number, rotation: Rotation) {
  return rotation === 90 || rotation === 270 ? { w: h, h: w } : { w, h };
}

const FURNITURE_LOOK: Record<FurnitureDefId, { glyph: string; bg: string }> = {
  bed: { glyph: "🛏️", bg: "#F2C9C0" },
  sofa: { glyph: "🛋️", bg: "#B8D0A8" },
  table: { glyph: "🍽️", bg: "#E0C090" },
  chair: { glyph: "🪑", bg: "#D8B888" },
  counter: { glyph: "🍳", bg: "#D8D0C0" },
  refrigerator: { glyph: "🧊", bg: "#CFE4EC" },
  shelf: { glyph: "📚", bg: "#C8A078" },
  desk: { glyph: "🖋️", bg: "#C8A078" },
  lamp: { glyph: "💡", bg: "#FFF0B0" },
  rug: { glyph: "", bg: "#C4785A" },
  wall_art: { glyph: "🖼️", bg: "#F4E4C0" },
  houseplant: { glyph: "🪴", bg: "#BFE0A8" },
  fence: { glyph: "🚧", bg: "#D8C090" },
  path_deco: { glyph: "", bg: "#C4A070" },
  bench: { glyph: "🪑", bg: "#D8B888" },
  planter: { glyph: "🌷", bg: "#E8C8D0" },
  small_tree: { glyph: "🌳", bg: "#9ACB80" },
  flower_bed_deco: { glyph: "💐", bg: "#F0C8D8" },
  raised_bed: { glyph: "🌱", bg: "#A87850" },
};

function look(defId: string) {
  return FURNITURE_LOOK[defId as FurnitureDefId] ?? { glyph: "▫️", bg: "#E8D4A8" };
}

function furnitureName(defId: string) {
  return getFurniture(defId)?.name ?? defId.replaceAll("_", " ");
}

const PLANT_GLYPH: Record<PlantVarietyId, string> = {
  daisy: "🌼",
  rose: "🌹",
  lavender: "🪻",
  basil: "🌿",
  lettuce: "🥬",
  tomato: "🍅",
  space_flower: "🌺",
};

/** Game-time "now": the demo clock may run ahead of the wall clock. */
function useGameNow(): number {
  const { city } = useGame();
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setT(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);
  return Math.max(t, city?.economy.lastSettledAt ?? 0);
}

function useEscape(handler: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handler();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handler, active]);
}

function Panel({
  children,
  className = "",
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <section
      aria-label={label}
      className={`meadow-panel p-3 text-[#3a3020] ${className}`}
    >
      {children}
    </section>
  );
}

function PanelTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wide opacity-70">{children}</h3>;
}

/** "1 action + <cost icons>" — or "Free". */
function ActionCost({ actions, cost }: { actions: 0 | 1; cost?: CostMap }) {
  const hasCost = cost && RESOURCE_KEYS.some((k) => (cost[k] ?? 0) !== 0);
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-medium">
      <span>{actions === 0 ? (hasCost ? "0 actions" : "Free") : "1 action"}</span>
      {hasCost && (
        <>
          <span>+</span>
          <ResourceCostLine amounts={cost} />
        </>
      )}
    </span>
  );
}

function StatusStrip() {
  const { city } = useGame();
  if (!city) return null;
  const e = city.economy;
  return (
    <div
      className="meadow-chip inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold text-[#3a3020]"
      aria-label="Resources"
    >
      <ResourceAmount resource="happiness" amount={e.happiness} showLabel />
      <ResourceAmount resource="research" amount={e.research} showLabel />
      <ResourceAmount resource="coins" amount={e.coins} showLabel />
      <span className="rounded-full bg-[#8fbf6a]/30 px-2">{e.actionsRemaining}/2 actions</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirm sheet for paid operations (touch-friendly)
// ---------------------------------------------------------------------------

interface PendingOp {
  title: string;
  detail?: ReactNode;
  actions: 0 | 1;
  cost?: CostMap;
  confirmLabel?: string;
  run: () => Promise<unknown>;
}

function useConfirm() {
  const { city } = useGame();
  const [pending, setPending] = useState<PendingOp | null>(null);
  const [busy, setBusy] = useState(false);

  const clear = useCallback(() => setPending(null), []);
  useEscape(clear, Boolean(pending));

  const confirm = async () => {
    if (!pending || busy) return;
    setBusy(true);
    try {
      await pending.run();
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  let sheet: ReactNode = null;
  if (pending && city) {
    const e = city.economy;
    const blocked =
      pending.actions > 0 && e.actionsRemaining < 1
        ? "No actions left in this window."
        : !canAfford(e, toResources(pending.cost))
          ? "Not enough resources yet."
          : null;
    sheet = (
      <div
        role="dialog"
        aria-label={pending.title}
        className="meadow-panel absolute bottom-20 left-1/2 z-30 w-[min(94vw,28rem)] -translate-x-1/2 p-3 text-[#3a3020] md:bottom-4"
      >
        <div className="font-extrabold">{pending.title}</div>
        {pending.detail && <div className="mt-0.5 text-xs opacity-80">{pending.detail}</div>}
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-xs font-bold opacity-70">Cost</span>
          <ActionCost actions={pending.actions} cost={pending.cost} />
        </div>
        {blocked && (
          <div role="alert" className="mt-1 text-xs font-bold text-red-800">
            {blocked}
          </div>
        )}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className="meadow-btn meadow-btn-primary min-h-[52px] flex-1 text-base disabled:opacity-50"
            disabled={Boolean(blocked) || busy}
            onClick={() => void confirm()}
          >
            {busy ? "Working…" : (pending.confirmLabel ?? "Confirm")}
          </button>
          <button
            type="button"
            className="meadow-btn min-h-[52px] flex-1 text-base"
            disabled={busy}
            onClick={clear}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return { pending, ask: setPending, clear, sheet };
}

// ---------------------------------------------------------------------------
// Scene frame
// ---------------------------------------------------------------------------

type Tone = "home" | "garden" | "space" | "trail";

const TONE_BG: Record<Tone, string> = {
  home: "linear-gradient(180deg,#f3e2bd 0%,#ecd3a3 100%)",
  garden: "linear-gradient(180deg,#cfe6b0 0%,#a9cf86 100%)",
  space: "linear-gradient(180deg,#0f1630 0%,#1d2a55 60%,#2b3a6e 100%)",
  trail: "linear-gradient(180deg,#d6e4c0 0%,#b9cfa0 100%)",
};

function SceneFrame({
  title,
  subtitle,
  tone,
  actions,
  overlay,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  tone: Tone;
  actions?: ReactNode;
  overlay?: ReactNode;
  children: ReactNode;
}) {
  const { returnToCity } = useGame();
  const dark = tone === "space";
  return (
    <section aria-label={title} className="absolute inset-0 z-10">
      <div
        className={`absolute inset-0 overflow-y-auto px-3 pb-44 pt-44 md:pt-32 ${dark ? "text-[#f4ecd8]" : "text-[#3a3020]"}`}
        style={{ background: TONE_BG[tone] }}
      >
        <div className="mx-auto w-full max-w-5xl">
          <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="meadow-title text-2xl">{title}</h2>
              {subtitle && <p className="text-sm opacity-80">{subtitle}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusStrip />
              {actions}
              <button type="button" className="meadow-btn" onClick={() => returnToCity()}>
                Back to city
              </button>
            </div>
          </header>
          {children}
        </div>
      </div>
      {overlay}
    </section>
  );
}

function MissingScene({ what }: { what: string }) {
  const { returnToCity } = useGame();
  return (
    <section className="absolute inset-0 z-10 flex items-center justify-center bg-[#f3e2bd] p-4">
      <Panel className="max-w-sm text-center">
        <p className="font-bold">This {what} is not available.</p>
        <p className="mt-1 text-sm opacity-80">It may have been reset or moved.</p>
        <button type="button" className="meadow-btn meadow-btn-primary mt-3" onClick={() => returnToCity()}>
          Back to city
        </button>
      </Panel>
    </section>
  );
}

function Notice({ children }: { children: ReactNode }) {
  if (!children) return <div className="min-h-5" aria-live="polite" />;
  return (
    <p role="status" aria-live="polite" className="min-h-5 text-xs font-bold text-red-800">
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Launch animation (never rendered under reduced motion)
// ---------------------------------------------------------------------------

function LaunchOverlay() {
  const { launchFx, clearLaunchFx, reducedMotion } = useGame();
  useEffect(() => {
    if (!launchFx) return;
    const id = setTimeout(clearLaunchFx, reducedMotion ? 0 : 2000);
    return () => clearTimeout(id);
  }, [launchFx, clearLaunchFx, reducedMotion]);

  if (!launchFx || reducedMotion) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-[15] overflow-hidden" aria-hidden>
      <style>{`
        @keyframes ml-rocket-rise {
          0% { transform: translate(-50%, 0) scale(1); opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translate(-50%, -105vh) scale(0.55); opacity: 0; }
        }
        @keyframes ml-flame { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(1.5); } }
        @keyframes ml-label { 0% { opacity: 0; } 20%,80% { opacity: 1; } 100% { opacity: 0; } }
      `}</style>
      <div
        key={launchFx.id}
        className="absolute bottom-6 left-1/2"
        style={{ animation: "ml-rocket-rise 1.8s ease-in forwards" }}
      >
        <svg width="46" height="104" viewBox="-23 -52 46 104">
          <polygon points="-11,12 -22,28 -11,26" fill="#A05A40" stroke="#3A3020" strokeWidth="1" />
          <polygon points="11,12 22,28 11,26" fill="#C4785A" stroke="#3A3020" strokeWidth="1" />
          <path
            d="M-11,26 L-11,-14 Q-11,-34 0,-48 Q11,-34 11,-14 L11,26 Q0,31 -11,26 Z"
            fill="#F4EEE0"
            stroke="#3A3020"
            strokeWidth="1.2"
          />
          <path d="M-11,-14 Q-11,-34 0,-48 Q11,-34 11,-14 Z" fill="#C4785A" stroke="#3A3020" strokeWidth="1.2" />
          <circle cx="0" cy="-2" r="5" fill="#FFE8A0" stroke="#3A3020" strokeWidth="1" />
          <g style={{ transformOrigin: "0px 30px", animation: "ml-flame 0.18s infinite" }}>
            <polygon points="-6,30 6,30 0,52" fill="#F0D060" />
            <polygon points="-3,30 3,30 0,42" fill="#FFF8D0" />
          </g>
        </svg>
      </div>
      <div
        className="absolute left-1/2 top-1/3 -translate-x-1/2 rounded-full bg-[#f5e6c8]/95 px-4 py-2 text-sm font-extrabold text-[#3a3020] shadow-lg"
        style={{ animation: "ml-label 1.8s ease-in-out forwards" }}
      >
        {launchFx.label}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inventory + selected-item panels (shared by interior and backyard)
// ---------------------------------------------------------------------------

function FurnitureInventory({
  title,
  items,
  armedId,
  onArm,
  empty,
}: {
  title: string;
  items: InventoryItem[];
  armedId: string | null;
  onArm: (id: string | null) => void;
  empty: string;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, InventoryItem[]>();
    for (const it of items) {
      const list = map.get(it.definitionId) ?? [];
      list.push(it);
      map.set(it.definitionId, list);
    }
    return [...map.entries()];
  }, [items]);

  return (
    <Panel label={title}>
      <PanelTitle>{title}</PanelTitle>
      {groups.length === 0 ? (
        <p className="text-sm opacity-70">{empty}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {groups.map(([defId, list]) => {
            const armed = list.some((i) => i.id === armedId);
            const def = getFurniture(defId);
            const l = look(defId);
            return (
              <button
                key={defId}
                type="button"
                aria-pressed={armed}
                className={`meadow-btn flex items-center gap-2 text-left ${armed ? "ring-4 ring-[#6b9e4a]" : ""}`}
                onClick={() => onArm(armed ? null : list[0].id)}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-black/10 text-lg"
                  style={{ background: l.bg }}
                  aria-hidden
                >
                  {l.glyph}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm leading-tight">
                    {furnitureName(defId)}
                    {list.length > 1 && <span className="opacity-60"> ×{list.length}</span>}
                  </span>
                  {def && (
                    <span className="block text-[10px] font-medium opacity-60">
                      {def.footprint.w}×{def.footprint.h}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function SelectedItemPanel({
  item,
  busy,
  onRotate,
  onStore,
  onClose,
  children,
}: {
  item: SceneItemPlacement;
  busy: boolean;
  onRotate: () => void;
  onStore: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <Panel label="Selected item">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-extrabold">{furnitureName(item.definitionId)}</div>
          <div className="text-xs opacity-70">
            Tile {item.x},{item.y} · {item.rotation}° · tap a tile to move (free)
          </div>
        </div>
        <button type="button" className="meadow-btn" onClick={onClose} aria-label="Deselect item">
          ✕
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="meadow-btn" disabled={busy} onClick={onRotate}>
          Rotate ↻
        </button>
        <button type="button" className="meadow-btn" disabled={busy} onClick={onStore}>
          Store (free)
        </button>
      </div>
      {children}
    </Panel>
  );
}

function ArmedBanner({
  name,
  rotation,
  onRotate,
  onCancel,
}: {
  name: string;
  rotation: Rotation;
  onRotate: () => void;
  onCancel: () => void;
}) {
  return (
    <Panel label="Placing item" className="border-2 border-[#6b9e4a]">
      <div className="text-sm font-bold">Placing {name} — tap a tile (free)</div>
      <div className="mt-2 flex gap-2">
        <button type="button" className="meadow-btn" onClick={onRotate}>
          Rotate ↻ {rotation}°
        </button>
        <button type="button" className="meadow-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </Panel>
  );
}

function PlacedItemButton({
  item,
  selected,
  clickThrough,
  onSelect,
  cellStyle,
}: {
  item: SceneItemPlacement;
  selected: boolean;
  clickThrough: boolean;
  onSelect: () => void;
  cellStyle: React.CSSProperties;
}) {
  const l = look(item.definitionId);
  const isFloor = item.layer === "floor";
  return (
    <button
      type="button"
      aria-label={`${furnitureName(item.definitionId)} at ${item.x},${item.y}`}
      aria-pressed={selected}
      onClick={onSelect}
      className={`relative m-[2px] flex items-center justify-center rounded-md border-2 border-black/25 text-lg sm:text-xl ${selected ? "ring-4 ring-[#6b9e4a]" : ""} ${clickThrough ? "pointer-events-none" : ""}`}
      style={{
        ...cellStyle,
        background: l.bg,
        opacity: isFloor ? 0.7 : 1,
        zIndex: isFloor ? 1 : 3,
      }}
    >
      <span aria-hidden>{l.glyph}</span>
      {item.rotation !== 0 && (
        <span className="absolute right-0.5 top-0 text-[8px] font-bold opacity-60" aria-hidden>
          {item.rotation}°
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// 1. Home interior
// ---------------------------------------------------------------------------

const ZONE_STYLE: Record<string, { bg: string; alt: string; label: string }> = {
  living: { bg: "#F0E0B8", alt: "#EBD9AB", label: "Living" },
  sleeping: { bg: "#F4DCD2", alt: "#EFD2C6", label: "Sleeping" },
  kitchen: { bg: "#DCE8CC", alt: "#D2E0C0", label: "Kitchen" },
  bathroom: { bg: "#D2E6EE", alt: "#C7DEE8", label: "Bath" },
  addition: { bg: "#EADFC4", alt: "#E3D6B6", label: "Addition" },
};

const ROOM_ADD_SPOTS = [
  { x: 8, y: 0 },
  { x: 8, y: 4 },
  { x: 0, y: 8 },
  { x: 4, y: 8 },
];

function InteriorView({ sceneId, houseEntityId }: { sceneId: string; houseEntityId: string }) {
  const { city, placeHomeItem, moveHomeItem, storeHomeItem, acquireBundle, addRoom, enterBackyard } =
    useGame();
  const confirm = useConfirm();
  const [armedId, setArmedId] = useState<string | null>(null);
  const [selItemId, setSelItemId] = useState<string | null>(null);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const cancel = useCallback(() => {
    setArmedId(null);
    setSelItemId(null);
    setHover(null);
    setNotice(null);
  }, []);
  useEscape(cancel, Boolean(armedId || selItemId));

  const scene = city?.expansion.interiors[sceneId];
  if (!city || !scene) return <MissingScene what="home interior" />;

  const cols = Math.max(8, ...scene.rooms.map((r) => r.x + r.w));
  const rows = Math.max(8, ...scene.rooms.map((r) => r.y + r.h));
  const roomAt = (x: number, y: number) =>
    scene.rooms.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);

  const inventory = city.expansion.inventory;
  const indoorInv = inventory.filter(
    (i) => i.kind === "furniture" && getFurniture(i.definitionId)?.indoor
  );
  const armed = armedId ? inventory.find((i) => i.id === armedId) : undefined;
  const selItem = selItemId ? scene.items.find((i) => i.itemId === selItemId) : undefined;
  const activeDefId = armed?.definitionId ?? selItem?.definitionId;

  const check = (x: number, y: number) => {
    if (!activeDefId) return null;
    const room = roomAt(x, y);
    const tiles = footprintTiles(activeDefId, x, y, rotation);
    if (!room) return { ok: false as const, reason: "Outside the house", tiles, roomId: "" };
    const v = validateInteriorPlacement(
      scene,
      activeDefId,
      x,
      y,
      rotation,
      room.id,
      armed ? undefined : selItem?.itemId
    );
    return {
      ok: v.ok,
      reason: v.ok ? undefined : v.error,
      tiles,
      roomId: room.id,
    };
  };
  const preview = hover ? check(hover.x, hover.y) : null;

  const onTile = async (x: number, y: number) => {
    setHover({ x, y });
    if (busy) return;
    const c = check(x, y);
    if (!c) return;
    if (!c.ok) {
      setNotice(c.reason ?? "Cannot place here");
      return;
    }
    setNotice(null);
    setBusy(true);
    try {
      if (armed) {
        const res = await placeHomeItem({
          sceneKind: "interior",
          sceneId,
          inventoryItemId: armed.id,
          x,
          y,
          rotation,
          roomId: c.roomId,
        });
        if (res.ok) setArmedId(null);
      } else if (selItem) {
        const res = await moveHomeItem({
          sceneKind: "interior",
          sceneId,
          itemId: selItem.itemId,
          x,
          y,
          rotation,
          roomId: c.roomId,
        });
        if (res.ok) setSelItemId(null);
      }
    } finally {
      setBusy(false);
    }
  };

  const selectItem = (item: SceneItemPlacement) => {
    setArmedId(null);
    setNotice(null);
    if (selItemId === item.itemId) {
      setSelItemId(null);
      return;
    }
    setSelItemId(item.itemId);
    setRotation(item.rotation);
  };

  const rotateInPlace = async () => {
    if (!selItem || busy) return;
    const r = nextRotation(selItem.rotation);
    const v = validateInteriorPlacement(
      scene,
      selItem.definitionId,
      selItem.x,
      selItem.y,
      r,
      selItem.roomId,
      selItem.itemId
    );
    if (!v.ok) {
      setNotice(v.error);
      return;
    }
    setBusy(true);
    try {
      const res = await moveHomeItem({
        sceneKind: "interior",
        sceneId,
        itemId: selItem.itemId,
        x: selItem.x,
        y: selItem.y,
        rotation: r,
        roomId: selItem.roomId,
      });
      if (res.ok) setRotation(r);
    } finally {
      setBusy(false);
    }
  };

  const storeSelected = async () => {
    if (!selItem || busy) return;
    setBusy(true);
    try {
      const res = await storeHomeItem({ sceneKind: "interior", sceneId, itemId: selItem.itemId });
      if (res.ok) setSelItemId(null);
    } finally {
      setBusy(false);
    }
  };

  const occupied = new Set(scene.rooms.map((r) => `${r.x},${r.y}`));
  const canAddRoom = ROOM_ADD_SPOTS.some((s) => !occupied.has(`${s.x},${s.y}`));
  const houseEntity = city.entities.find((e) => e.id === houseEntityId);

  const previewTiles = new Set(
    (preview?.tiles ?? [])
      .filter((t) => t.x >= 0 && t.y >= 0 && t.x < cols && t.y < rows)
      .map((t) => `${t.x},${t.y}`)
  );

  return (
    <SceneFrame
      title="Home interior"
      subtitle={`${houseEntity ? furnitureName(houseEntity.definitionId) : "Cottage"} cutaway · ${scene.rooms.length} rooms · rearranging is free`}
      tone="home"
      overlay={confirm.sheet}
      actions={
        <button type="button" className="meadow-btn" onClick={() => enterBackyard(houseEntityId)}>
          Backyard →
        </button>
      }
    >
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <div
            role="group"
            aria-label="Home plan"
            className="mx-auto grid w-full max-w-[34rem] overflow-hidden rounded-xl border-4 border-[#6b4a30] bg-[#5a3a20] shadow-lg"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
              aspectRatio: `${cols} / ${rows}`,
            }}
            onMouseLeave={() => setHover(null)}
          >
            {Array.from({ length: rows }, (_, y) =>
              Array.from({ length: cols }, (_, x) => {
                const room = roomAt(x, y);
                if (!room) {
                  return (
                    <div
                      key={`${x},${y}`}
                      aria-hidden
                      style={{ gridColumn: x + 1, gridRow: y + 1 }}
                      className="bg-[#3a2a1a]"
                    />
                  );
                }
                const z = ZONE_STYLE[room.zone] ?? ZONE_STYLE.addition;
                const isDoor = x === room.x && y === room.y;
                return (
                  <button
                    key={`${x},${y}`}
                    type="button"
                    aria-label={`${z.label} tile ${x},${y}`}
                    onMouseEnter={() => setHover({ x, y })}
                    onFocus={() => setHover({ x, y })}
                    onClick={() => void onTile(x, y)}
                    className="relative flex items-start justify-start p-0 text-[9px] leading-none outline-offset-[-3px] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#7eb8d4]"
                    style={{
                      gridColumn: x + 1,
                      gridRow: y + 1,
                      background: (x + y) % 2 === 0 ? z.bg : z.alt,
                      cursor: armed || selItem ? "pointer" : "default",
                    }}
                  >
                    {isDoor && (
                      <span className="m-0.5 opacity-40" aria-hidden title="Doorway — keep clear">
                        ▥
                      </span>
                    )}
                  </button>
                );
              })
            )}

            {/* Room walls + labels (click-through) */}
            {scene.rooms.map((r) => (
              <div
                key={r.id}
                aria-hidden
                className="pointer-events-none relative border-[3px] border-[#6b4a30]/70"
                style={{
                  gridColumn: `${r.x + 1} / span ${r.w}`,
                  gridRow: `${r.y + 1} / span ${r.h}`,
                  zIndex: 2,
                }}
              >
                <span className="absolute right-1 top-0.5 text-[9px] font-extrabold uppercase tracking-wide opacity-50">
                  {(ZONE_STYLE[r.zone] ?? ZONE_STYLE.addition).label}
                </span>
              </div>
            ))}

            {/* Placed furniture */}
            {scene.items.map((it) => {
              const def = getFurniture(it.definitionId);
              const size = rotatedSize(def?.footprint.w ?? 1, def?.footprint.h ?? 1, it.rotation);
              return (
                <PlacedItemButton
                  key={it.itemId}
                  item={it}
                  selected={it.itemId === selItemId}
                  clickThrough={Boolean(armed)}
                  onSelect={() => selectItem(it)}
                  cellStyle={{
                    gridColumn: `${it.x + 1} / span ${size.w}`,
                    gridRow: `${it.y + 1} / span ${size.h}`,
                  }}
                />
              );
            })}

            {/* Placement preview */}
            {preview &&
              [...previewTiles].map((k) => {
                const [x, y] = k.split(",").map(Number);
                return (
                  <div
                    key={`pv-${k}`}
                    aria-hidden
                    className="pointer-events-none"
                    style={{
                      gridColumn: x + 1,
                      gridRow: y + 1,
                      zIndex: 4,
                      background: preview.ok ? "rgba(107,196,106,0.45)" : "rgba(212,96,80,0.5)",
                      outline: `2px solid ${preview.ok ? "#3f8a3f" : "#a8382c"}`,
                      outlineOffset: -2,
                    }}
                  />
                );
              })}
          </div>
          <div className="mx-auto mt-2 max-w-[34rem]">
            <Notice>{notice ?? (preview && !preview.ok ? preview.reason : null)}</Notice>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {armed && (
            <ArmedBanner
              name={furnitureName(armed.definitionId)}
              rotation={rotation}
              onRotate={() => setRotation(nextRotation(rotation))}
              onCancel={cancel}
            />
          )}
          {selItem && !armed && (
            <SelectedItemPanel
              item={selItem}
              busy={busy}
              onRotate={() => void rotateInPlace()}
              onStore={() => void storeSelected()}
              onClose={cancel}
            />
          )}
          <FurnitureInventory
            title="Inventory (indoor)"
            items={indoorInv}
            armedId={armedId}
            empty="Nothing stored. Acquire a bundle below or store placed furniture."
            onArm={(id) => {
              setSelItemId(null);
              setNotice(null);
              setArmedId(id);
              setRotation(0);
            }}
          />
          <Panel label="Furnishing bundles">
            <PanelTitle>Furnishing bundles</PanelTitle>
            <div className="flex flex-col gap-2">
              {Object.values(FURNITURE_BUNDLES).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className="meadow-btn text-left"
                  onClick={() =>
                    confirm.ask({
                      title: `Acquire ${b.name}`,
                      detail: b.items
                        .map((i) => `${i.count}× ${furnitureName(i.definitionId)}`)
                        .join(", "),
                      actions: 1,
                      cost: b.cost,
                      confirmLabel: "Acquire",
                      run: () => acquireBundle(b.id),
                    })
                  }
                >
                  <div className="text-sm">{b.name}</div>
                  <ActionCost actions={1} cost={b.cost} />
                </button>
              ))}
              <button
                type="button"
                className="meadow-btn text-left disabled:opacity-50"
                disabled={!canAddRoom}
                onClick={() =>
                  confirm.ask({
                    title: "Add a room",
                    detail: "A 4×4 addition attached to the plan.",
                    actions: 1,
                    cost: ROOM_ADD_COST,
                    confirmLabel: "Build room",
                    run: () => addRoom(sceneId),
                  })
                }
              >
                <div className="text-sm">Add room{!canAddRoom && " (no space left)"}</div>
                <ActionCost actions={1} cost={ROOM_ADD_COST} />
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </SceneFrame>
  );
}

// ---------------------------------------------------------------------------
// 2. Backyard (12×12) + planting UI
// ---------------------------------------------------------------------------

function slotIsMature(slot: GardenPlot, now: number) {
  return Boolean(slot.varietyId && slot.matureAt && now >= slot.matureAt);
}

function PlantingPanel({
  bed,
  now,
  seedUnlocks,
  onPlant,
}: {
  bed: SceneItemPlacement;
  now: number;
  seedUnlocks: PlantVarietyId[];
  onPlant: (changes: { slotIndex: number; varietyId: PlantVarietyId | null }[], coinCost: number) => void;
}) {
  const [brush, setBrush] = useState<PlantVarietyId | "uproot" | null>(null);
  const [draft, setDraft] = useState<Record<number, PlantVarietyId | null>>({});
  const slots = bed.bedState?.slots ?? [];

  const brushValue: PlantVarietyId | null | undefined =
    brush === null ? undefined : brush === "uproot" ? null : brush;

  const apply = (slotIndex: number) => {
    if (brushValue === undefined) return;
    setDraft((d) => {
      const next = { ...d };
      if (slotIndex in next && next[slotIndex] === brushValue) delete next[slotIndex];
      else next[slotIndex] = brushValue;
      return next;
    });
  };

  const fillEmpty = () => {
    if (brushValue === undefined || brushValue === null) return;
    setDraft((d) => {
      const next = { ...d };
      for (const s of slots) if (!s.varietyId && !(s.slotIndex in next)) next[s.slotIndex] = brushValue;
      return next;
    });
  };

  const changes = Object.entries(draft)
    .map(([k, v]) => ({ slotIndex: Number(k), varietyId: v }))
    .filter((c) => {
      const slot = slots[c.slotIndex];
      if (!slot) return false;
      if (c.varietyId === null) return Boolean(slot.varietyId);
      const unchanged =
        slot.varietyId === c.varietyId && !slotIsMature(slot, now) && Boolean(slot.plantingCycleId);
      return !unchanged;
    });
  const coinCost = changes.length * PLANT_SLOT_COIN_COST;

  return (
    <Panel label="Planting">
      <PanelTitle>Planting — raised bed</PanelTitle>
      <p className="mb-2 text-xs opacity-70">
        Pick a seed, then tap slots. Up to 4 slots per action ·{" "}
        <span className="inline-flex items-center gap-1 align-middle">
          <ResourceAmount resource="coins" amount={PLANT_SLOT_COIN_COST} size="sm" /> per slot
        </span>
        . Harvests drop into your inventory automatically.
      </p>

      <div className="mb-2 grid grid-cols-2 gap-2">
        {slots.map((slot) => {
          const pending = slot.slotIndex in draft ? draft[slot.slotIndex] : undefined;
          const plant = slot.varietyId ? PLANTS[slot.varietyId] : undefined;
          const mature = slotIsMature(slot, now);
          return (
            <button
              key={slot.slotIndex}
              type="button"
              aria-label={`Slot ${slot.slotIndex + 1}`}
              onClick={() => apply(slot.slotIndex)}
              className={`meadow-btn flex min-h-[72px] flex-col items-center justify-center text-center ${pending !== undefined ? "ring-4 ring-[#e8c060]" : ""}`}
            >
              <span className="text-2xl" aria-hidden>
                {pending === null
                  ? "✂️"
                  : pending
                    ? PLANT_GLYPH[pending]
                    : plant
                      ? mature
                        ? PLANT_GLYPH[plant.id]
                        : "🌱"
                      : "·"}
              </span>
              <span className="text-[11px] font-bold leading-tight">
                {pending === null
                  ? "Will uproot"
                  : pending
                    ? `Plant ${PLANTS[pending].name}`
                    : plant
                      ? mature
                        ? `${plant.name} — ready`
                        : `${plant.name} · ${formatDuration(Math.max(0, (slot.matureAt ?? now) - now))}`
                      : "Empty"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Seed brush">
        {Object.values(PLANTS).map((p) => {
          const unlocked = seedUnlocks.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              disabled={!unlocked}
              aria-pressed={brush === p.id}
              title={
                unlocked
                  ? `${p.name} · ${p.family} · ${formatDuration(p.maturityMs)}`
                  : "Install a Plant-Growth Chamber in orbit to unlock"
              }
              onClick={() => setBrush(brush === p.id ? null : p.id)}
              className={`meadow-btn px-2 text-sm disabled:opacity-40 ${brush === p.id ? "ring-4 ring-[#6b9e4a]" : ""}`}
            >
              <span aria-hidden>{PLANT_GLYPH[p.id]}</span> {p.name}
              <span className="block text-[9px] font-medium opacity-60">
                {unlocked ? `${p.family} · ${formatDuration(p.maturityMs)}` : "locked"}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={brush === "uproot"}
          onClick={() => setBrush(brush === "uproot" ? null : "uproot")}
          className={`meadow-btn px-2 text-sm ${brush === "uproot" ? "ring-4 ring-[#d46050]" : ""}`}
        >
          ✂️ Uproot
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="meadow-btn"
          disabled={brushValue === undefined || brushValue === null}
          onClick={fillEmpty}
        >
          Fill empty
        </button>
        <button
          type="button"
          className="meadow-btn"
          disabled={Object.keys(draft).length === 0}
          onClick={() => setDraft({})}
        >
          Clear
        </button>
        <button
          type="button"
          className="meadow-btn meadow-btn-primary disabled:opacity-50"
          disabled={changes.length === 0}
          onClick={() => {
            onPlant(changes, coinCost);
            setDraft({});
          }}
        >
          Plant {changes.length || ""} slot{changes.length === 1 ? "" : "s"}
        </button>
      </div>
      {changes.length > 0 && (
        <div className="mt-2">
          <ActionCost actions={1} cost={{ coins: coinCost }} />
        </div>
      )}
    </Panel>
  );
}

function BackyardView({ sceneId, houseEntityId }: { sceneId: string; houseEntityId: string }) {
  const { city, placeHomeItem, moveHomeItem, storeHomeItem, buildGardenBed, plantBatch, enterHome } =
    useGame();
  const confirm = useConfirm();
  const now = useGameNow();
  const [armedId, setArmedId] = useState<string | null>(null);
  const [selItemId, setSelItemId] = useState<string | null>(null);
  const [buildBed, setBuildBed] = useState(false);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const cancel = useCallback(() => {
    setArmedId(null);
    setSelItemId(null);
    setBuildBed(false);
    setHover(null);
    setNotice(null);
  }, []);
  useEscape(cancel, Boolean(armedId || selItemId || buildBed));

  const scene = city?.expansion.backyards[sceneId];
  if (!city || !scene) return <MissingScene what="backyard" />;

  const inventory = city.expansion.inventory;
  const outdoorInv = inventory.filter(
    (i) => i.kind === "furniture" && getFurniture(i.definitionId)?.outdoor
  );
  const harvest = inventory.filter((i) => i.kind === "harvest");
  const armed = armedId ? inventory.find((i) => i.id === armedId) : undefined;
  const selItem = selItemId ? scene.items.find((i) => i.itemId === selItemId) : undefined;
  const selBed = selItem?.definitionId === "raised_bed" && selItem.bedState ? selItem : undefined;
  const activeDefId = buildBed ? "raised_bed" : (armed?.definitionId ?? selItem?.definitionId);
  const activeRotation: Rotation = buildBed ? 0 : rotation;

  const check = (x: number, y: number) => {
    if (!activeDefId) return null;
    const tiles = footprintTiles(activeDefId, x, y, activeRotation);
    const v = validateBackyardPlacement(
      scene,
      activeDefId,
      x,
      y,
      activeRotation,
      armed || buildBed ? undefined : selItem?.itemId
    );
    return { ok: v.ok, reason: v.ok ? undefined : v.error, tiles };
  };
  const preview = hover ? check(hover.x, hover.y) : null;
  const previewTiles = new Set((preview?.tiles ?? []).map((t) => `${t.x},${t.y}`));

  const onTile = async (x: number, y: number) => {
    setHover({ x, y });
    if (busy) return;
    const c = check(x, y);
    if (!c) return;
    if (!c.ok) {
      setNotice(c.reason ?? "Cannot place here");
      return;
    }
    setNotice(null);
    if (buildBed) {
      confirm.ask({
        title: `Build a raised bed at ${x},${y}`,
        detail: "A 2×2 bed with four planting slots.",
        actions: 1,
        cost: GARDEN_BED_COST,
        confirmLabel: "Build bed",
        run: async () => {
          const res = await buildGardenBed(sceneId, x, y);
          if (res.ok) setBuildBed(false);
        },
      });
      return;
    }
    setBusy(true);
    try {
      if (armed) {
        const res = await placeHomeItem({
          sceneKind: "backyard",
          sceneId,
          inventoryItemId: armed.id,
          x,
          y,
          rotation,
          roomId: "backyard",
        });
        if (res.ok) setArmedId(null);
      } else if (selItem) {
        const res = await moveHomeItem({
          sceneKind: "backyard",
          sceneId,
          itemId: selItem.itemId,
          x,
          y,
          rotation,
          roomId: "backyard",
        });
        if (res.ok) setSelItemId(null);
      }
    } finally {
      setBusy(false);
    }
  };

  const selectItem = (item: SceneItemPlacement) => {
    setArmedId(null);
    setBuildBed(false);
    setNotice(null);
    if (selItemId === item.itemId) {
      setSelItemId(null);
      return;
    }
    setSelItemId(item.itemId);
    setRotation(item.rotation);
  };

  const rotateInPlace = async () => {
    if (!selItem || busy) return;
    const r = nextRotation(selItem.rotation);
    const v = validateBackyardPlacement(scene, selItem.definitionId, selItem.x, selItem.y, r, selItem.itemId);
    if (!v.ok) {
      setNotice(v.error);
      return;
    }
    setBusy(true);
    try {
      const res = await moveHomeItem({
        sceneKind: "backyard",
        sceneId,
        itemId: selItem.itemId,
        x: selItem.x,
        y: selItem.y,
        rotation: r,
        roomId: "backyard",
      });
      if (res.ok) setRotation(r);
    } finally {
      setBusy(false);
    }
  };

  const storeSelected = async () => {
    if (!selItem || busy) return;
    setBusy(true);
    try {
      const res = await storeHomeItem({ sceneKind: "backyard", sceneId, itemId: selItem.itemId });
      if (res.ok) setSelItemId(null);
    } finally {
      setBusy(false);
    }
  };

  const harvestCounts = new Map<string, number>();
  for (const h of harvest) harvestCounts.set(h.definitionId, (harvestCounts.get(h.definitionId) ?? 0) + h.quantity);
  const harvestName = (id: string) =>
    Object.values(PLANTS).find((p) => p.harvestItemId === id)?.harvestName ?? id;

  return (
    <SceneFrame
      title="Backyard"
      subtitle={`${scene.width}×${scene.height} yard · ${scene.items.filter((i) => i.definitionId === "raised_bed").length} raised bed(s) · blooms +${city.expansion.backyardHappinessRate} happiness / 12h`}
      tone="garden"
      overlay={confirm.sheet}
      actions={
        <button type="button" className="meadow-btn" onClick={() => enterHome(houseEntityId)}>
          ← Home
        </button>
      }
    >
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_21rem]">
        <div>
          <div className="overflow-auto rounded-xl border-4 border-[#4f7a35] bg-[#4f7a35] p-0 shadow-lg">
            <div
              role="group"
              aria-label="Backyard plan"
              className="mx-auto grid w-max [--cell:2rem] md:[--cell:2.4rem]"
              style={{
                gridTemplateColumns: `repeat(${scene.width}, var(--cell))`,
                gridTemplateRows: `repeat(${scene.height}, var(--cell))`,
              }}
              onMouseLeave={() => setHover(null)}
            >
              {Array.from({ length: scene.height }, (_, y) =>
                Array.from({ length: scene.width }, (_, x) => (
                  <button
                    key={`${x},${y}`}
                    type="button"
                    aria-label={`Yard tile ${x},${y}`}
                    onMouseEnter={() => setHover({ x, y })}
                    onFocus={() => setHover({ x, y })}
                    onClick={() => void onTile(x, y)}
                    className="outline-offset-[-3px] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#7eb8d4]"
                    style={{
                      gridColumn: x + 1,
                      gridRow: y + 1,
                      background: (x + y) % 2 === 0 ? "#9ccb7e" : "#92c274",
                      cursor: armed || selItem || buildBed ? "pointer" : "default",
                    }}
                  />
                ))
              )}

              {scene.items.map((it) => {
                const def = getFurniture(it.definitionId);
                const size = rotatedSize(def?.footprint.w ?? 1, def?.footprint.h ?? 1, it.rotation);
                const cellStyle = {
                  gridColumn: `${it.x + 1} / span ${size.w}`,
                  gridRow: `${it.y + 1} / span ${size.h}`,
                };
                if (it.definitionId === "raised_bed" && it.bedState) {
                  const selected = it.itemId === selItemId;
                  return (
                    <button
                      key={it.itemId}
                      type="button"
                      aria-label={`Raised bed at ${it.x},${it.y}`}
                      aria-pressed={selected}
                      onClick={() => selectItem(it)}
                      className={`relative m-[2px] grid grid-cols-2 grid-rows-2 gap-[2px] rounded-md border-2 border-[#5a3a20] bg-[#8a5a38] p-[2px] ${selected ? "ring-4 ring-[#e8c060]" : ""} ${armed || buildBed ? "pointer-events-none" : ""}`}
                      style={{ ...cellStyle, zIndex: 3 }}
                    >
                      {it.bedState.slots.map((slot) => (
                        <span
                          key={slot.slotIndex}
                          aria-hidden
                          className="flex items-center justify-center rounded-sm bg-[#6b4a30] text-sm"
                        >
                          {slot.varietyId
                            ? slotIsMature(slot, now)
                              ? PLANT_GLYPH[slot.varietyId]
                              : "🌱"
                            : ""}
                        </span>
                      ))}
                    </button>
                  );
                }
                return (
                  <PlacedItemButton
                    key={it.itemId}
                    item={it}
                    selected={it.itemId === selItemId}
                    clickThrough={Boolean(armed || buildBed)}
                    onSelect={() => selectItem(it)}
                    cellStyle={cellStyle}
                  />
                );
              })}

              {preview &&
                [...previewTiles]
                  .map((k) => k.split(",").map(Number))
                  .filter(([x, y]) => x >= 0 && y >= 0 && x < scene.width && y < scene.height)
                  .map(([x, y]) => (
                    <div
                      key={`pv-${x},${y}`}
                      aria-hidden
                      className="pointer-events-none"
                      style={{
                        gridColumn: x + 1,
                        gridRow: y + 1,
                        zIndex: 4,
                        background: preview.ok ? "rgba(107,196,106,0.45)" : "rgba(212,96,80,0.5)",
                        outline: `2px solid ${preview.ok ? "#3f8a3f" : "#a8382c"}`,
                        outlineOffset: -2,
                      }}
                    />
                  ))}
            </div>
          </div>
          <div className="mt-2">
            <Notice>{notice ?? (preview && !preview.ok ? preview.reason : null)}</Notice>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {buildBed && (
            <Panel label="Building a bed" className="border-2 border-[#6b9e4a]">
              <div className="text-sm font-bold">Tap a free 2×2 spot for the raised bed</div>
              <div className="mt-1">
                <ActionCost actions={1} cost={GARDEN_BED_COST} />
              </div>
              <button type="button" className="meadow-btn mt-2" onClick={cancel}>
                Cancel
              </button>
            </Panel>
          )}
          {armed && (
            <ArmedBanner
              name={furnitureName(armed.definitionId)}
              rotation={rotation}
              onRotate={() => setRotation(nextRotation(rotation))}
              onCancel={cancel}
            />
          )}
          {selItem && !armed && !buildBed && (
            <SelectedItemPanel
              item={selItem}
              busy={busy}
              onRotate={() => void rotateInPlace()}
              onStore={() => void storeSelected()}
              onClose={cancel}
            />
          )}
          {selBed && !armed && !buildBed && (
            <PlantingPanel
              key={selBed.itemId}
              bed={selBed}
              now={now}
              seedUnlocks={city.expansion.seedUnlocks}
              onPlant={(changes, coinCost) =>
                confirm.ask({
                  title: `Plant ${changes.length} slot${changes.length === 1 ? "" : "s"}`,
                  detail: changes
                    .map((c) =>
                      c.varietyId ? `Slot ${c.slotIndex + 1}: ${PLANTS[c.varietyId].name}` : `Slot ${c.slotIndex + 1}: uproot`
                    )
                    .join(" · "),
                  actions: 1,
                  cost: { coins: coinCost },
                  confirmLabel: "Plant",
                  run: () => plantBatch(sceneId, selBed.itemId, changes),
                })
              }
            />
          )}
          {!selBed && !buildBed && (
            <Panel label="Garden beds">
              <PanelTitle>Garden</PanelTitle>
              <p className="mb-2 text-xs opacity-70">Tap a raised bed to plant. Build more below.</p>
              <button
                type="button"
                className="meadow-btn w-full text-left"
                onClick={() => {
                  setArmedId(null);
                  setSelItemId(null);
                  setBuildBed(true);
                }}
              >
                <div className="text-sm">Build raised bed</div>
                <ActionCost actions={1} cost={GARDEN_BED_COST} />
              </button>
            </Panel>
          )}
          <FurnitureInventory
            title="Inventory (outdoor)"
            items={outdoorInv}
            armedId={armedId}
            empty="No outdoor items stored."
            onArm={(id) => {
              setSelItemId(null);
              setBuildBed(false);
              setNotice(null);
              setArmedId(id);
              setRotation(0);
            }}
          />
          <Panel label="Harvest">
            <PanelTitle>Harvest basket</PanelTitle>
            {harvestCounts.size === 0 ? (
              <p className="text-sm opacity-70">Nothing harvested yet.</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5 text-sm font-bold">
                {[...harvestCounts.entries()].map(([id, n]) => (
                  <li key={id} className="meadow-chip">
                    {harvestName(id)} ×{n}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </SceneFrame>
  );
}

// ---------------------------------------------------------------------------
// 3. Station orbital view
// ---------------------------------------------------------------------------

const MODULE_LOOK: Record<StationModuleDefId | "core", { glyph: string; bg: string }> = {
  core: { glyph: "🛰️", bg: "#c9d4e8" },
  corridor: { glyph: "═", bg: "#b8c0d0" },
  habitation: { glyph: "🏠", bg: "#e8d8b8" },
  laboratory: { glyph: "🔬", bg: "#cfe4ec" },
  greenhouse: { glyph: "🌱", bg: "#c4e0b0" },
  observatory: { glyph: "🔭", bg: "#d8c8e8" },
  solar_power: { glyph: "☀️", bg: "#f4e4a0" },
};

const INSTRUMENT_GLYPH: Record<InstrumentDefId, string> = {
  telescope: "🔭",
  survey_console: "🗺️",
  plant_growth_chamber: "🧪",
};

const PORT_STYLE: Record<"n" | "e" | "s" | "w", string> = {
  n: "left-1/2 top-0 h-1.5 w-5 -translate-x-1/2",
  s: "bottom-0 left-1/2 h-1.5 w-5 -translate-x-1/2",
  w: "left-0 top-1/2 h-5 w-1.5 -translate-y-1/2",
  e: "right-0 top-1/2 h-5 w-1.5 -translate-y-1/2",
};

function moduleName(defId: StationModuleDefId | "core") {
  return defId === "core" ? "Station core" : STATION_MODULES[defId].name;
}

function ModuleCell({
  defId,
  rotation,
  instruments,
  selected,
  ghost,
  ghostOk,
  onClick,
  label,
}: {
  defId: StationModuleDefId | "core";
  rotation: Rotation;
  instruments?: StationModule["instruments"];
  selected?: boolean;
  ghost?: boolean;
  ghostOk?: boolean;
  onClick?: () => void;
  label: string;
}) {
  const l = MODULE_LOOK[defId];
  const ports = modulePorts(defId, rotation);
  const body = (
    <>
      {ports.map((p) => (
        <span
          key={p}
          aria-hidden
          className={`absolute rounded-sm bg-[#7c88a8] ${PORT_STYLE[p]}`}
        />
      ))}
      <span className="text-2xl" aria-hidden>
        {l.glyph}
      </span>
      <span className="px-1 text-center text-[9px] font-extrabold leading-tight">
        {moduleName(defId)}
      </span>
      {instruments && instruments.length > 0 && (
        <span className="absolute bottom-0.5 right-1 text-xs" aria-hidden>
          {instruments.filter((i) => i.operational).map((i) => INSTRUMENT_GLYPH[i.definitionId]).join("")}
        </span>
      )}
    </>
  );
  const cls = `relative flex h-full w-full flex-col items-center justify-center rounded-lg border-2 text-[#2a2a3a] ${selected ? "ring-4 ring-[#e8c060]" : ""} ${ghost ? (ghostOk ? "border-dashed border-[#6bc46a] opacity-80" : "border-dashed border-[#d46050] opacity-70") : "border-[#3a3a5a]"}`;
  if (!onClick) {
    return (
      <div aria-label={label} className={cls} style={{ background: l.bg }}>
        {body}
      </div>
    );
  }
  return (
    <button type="button" aria-label={label} aria-pressed={selected} onClick={onClick} className={cls} style={{ background: l.bg }}>
      {body}
    </button>
  );
}

const STAR_FIELD = [
  "radial-gradient(1.5px 1.5px at 12% 18%, #fff 50%, transparent 52%)",
  "radial-gradient(1px 1px at 28% 62%, #dfe8ff 50%, transparent 52%)",
  "radial-gradient(1.5px 1.5px at 44% 30%, #fff 50%, transparent 52%)",
  "radial-gradient(1px 1px at 63% 12%, #fff 50%, transparent 52%)",
  "radial-gradient(1.5px 1.5px at 78% 48%, #ffeec0 50%, transparent 52%)",
  "radial-gradient(1px 1px at 90% 80%, #fff 50%, transparent 52%)",
  "radial-gradient(1px 1px at 8% 86%, #fff 50%, transparent 52%)",
  "radial-gradient(1.5px 1.5px at 55% 74%, #dfe8ff 50%, transparent 52%)",
].join(",");

function StationView({ stationId }: { stationId: string }) {
  const {
    city,
    launchModule,
    launchInstrument,
    storeStationModule,
    restoreStationModule,
  } = useGame();
  const confirm = useConfirm();
  const [placeDef, setPlaceDef] = useState<StationModuleDefId | null>(null);
  const [selCell, setSelCell] = useState<{ gx: number; gy: number } | null>(null);
  const [selModuleId, setSelModuleId] = useState<string | null>(null);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [busy, setBusy] = useState(false);

  const cancel = useCallback(() => {
    setPlaceDef(null);
    setSelCell(null);
    setSelModuleId(null);
  }, []);
  useEscape(cancel, Boolean(placeDef || selCell || selModuleId));

  const station = city?.expansion.stations[stationId];
  if (!city || !station) return <MissingScene what="station" />;

  const placed = placedModules(station);
  const stored = station.modules.filter((m) => m.stored && m.definitionId !== "core");
  const power = stationPower(station);
  const byPos = new Map(placed.map((m) => [`${m.gx},${m.gy}`, m]));
  const minX = Math.min(...placed.map((m) => m.gx)) - 1;
  const maxX = Math.max(...placed.map((m) => m.gx)) + 1;
  const minY = Math.min(...placed.map((m) => m.gy)) - 1;
  const maxY = Math.max(...placed.map((m) => m.gy)) + 1;
  const cols = maxX - minX + 1;
  const rows = maxY - minY + 1;
  const isPad = (gx: number, gy: number) =>
    !byPos.has(`${gx},${gy}`) &&
    [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].some(([dx, dy]) => byPos.has(`${gx + dx},${gy + dy}`));

  const selModule = selModuleId ? placed.find((m) => m.id === selModuleId) : undefined;
  const attach =
    selCell && placeDef
      ? validateModuleAttachment(station, placeDef, selCell.gx, selCell.gy, rotation)
      : null;

  const flowerUnlocked = city.expansion.seedUnlocks.includes("space_flower");

  const doLaunchModule = () => {
    if (!selCell || !placeDef || !attach?.ok) return;
    const def = STATION_MODULES[placeDef];
    const { gx, gy } = selCell;
    confirm.ask({
      title: `Launch ${def.name}`,
      detail: `Attach at pad ${gx},${gy}, facing ${rotation}°.`,
      actions: 1,
      cost: def.cost,
      confirmLabel: "Launch 🚀",
      run: async () => {
        const res = await launchModule({
          stationId,
          definitionId: placeDef,
          gx,
          gy,
          rotation,
        });
        if (res.ok) {
          setSelCell(null);
          setPlaceDef(null);
        }
      },
    });
  };

  const doInstall = (instrumentId: InstrumentDefId) => {
    if (!selModule) return;
    const idef = INSTRUMENTS[instrumentId];
    confirm.ask({
      title: `Install ${idef.name}`,
      detail: `In ${moduleName(selModule.definitionId)} · uses ${idef.powerCost} power${instrumentId === "plant_growth_chamber" ? " · unlocks Orbital Bloom seeds" : ""}.`,
      actions: 1,
      cost: idef.cost,
      confirmLabel: "Launch instrument 🚀",
      run: () => launchInstrument({ stationId, moduleId: selModule.id, instrumentId }),
    });
  };

  const storeCheck = selModule ? canStoreModule(station, selModule.id) : null;

  return (
    <SceneFrame
      title="Orbital station"
      subtitle={
        <>
          {placed.length} module{placed.length === 1 ? "" : "s"} · power {power.used}/{power.provided} · 1 R ={" "}
          <ResourceAmount resource="research" amount={SPACE_RESEARCH_UNIT} size="sm" className="align-middle" />
        </>
      }
      tone="space"
      overlay={confirm.sheet}
    >
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_21rem]">
        <div>
          <div
            className="relative overflow-hidden rounded-2xl border-2 border-[#3a4a7a] p-3"
            style={{ background: `${STAR_FIELD}, linear-gradient(180deg,#0a1028,#18224a)` }}
          >
            {/* Home planet on the horizon */}
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-[85%] left-1/2 aspect-square w-[150%] -translate-x-1/2 rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 50% 8%, #8fbf6a 0%, #6b9e4a 16%, #5a9bb8 34%, #1e3a6a 70%)",
                boxShadow: "0 0 60px 10px rgba(126,184,212,0.35)",
              }}
            />
            <div
              role="group"
              aria-label="Station layout"
              className="relative mx-auto grid w-max max-w-full gap-1 overflow-x-auto"
              style={{
                gridTemplateColumns: `repeat(${cols}, 4.6rem)`,
                gridTemplateRows: `repeat(${rows}, 4.6rem)`,
              }}
            >
              {Array.from({ length: rows }, (_, ry) =>
                Array.from({ length: cols }, (_, rx) => {
                  const gx = minX + rx;
                  const gy = minY + ry;
                  const key = `${gx},${gy}`;
                  const style = { gridColumn: rx + 1, gridRow: ry + 1 };
                  const mod = byPos.get(key);
                  if (mod) {
                    return (
                      <div key={key} style={style}>
                        <ModuleCell
                          defId={mod.definitionId}
                          rotation={mod.rotation}
                          instruments={mod.instruments}
                          selected={mod.id === selModuleId}
                          label={`${moduleName(mod.definitionId)} at ${gx},${gy}`}
                          onClick={() => {
                            setSelModuleId(mod.id);
                            setSelCell(null);
                          }}
                        />
                      </div>
                    );
                  }
                  const pad = isPad(gx, gy);
                  const isSel = selCell?.gx === gx && selCell?.gy === gy;
                  if (isSel && placeDef) {
                    return (
                      <div key={key} style={style}>
                        <ModuleCell
                          defId={placeDef}
                          rotation={rotation}
                          ghost
                          ghostOk={Boolean(attach?.ok)}
                          label={`Launch pad ${gx},${gy} (selected)`}
                          onClick={() => setSelCell(null)}
                        />
                      </div>
                    );
                  }
                  if (!pad) return <div key={key} style={style} aria-hidden />;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-label={`Launch pad ${gx},${gy}`}
                      aria-pressed={isSel}
                      onClick={() => {
                        setSelCell({ gx, gy });
                        setSelModuleId(null);
                      }}
                      style={style}
                      className={`flex items-center justify-center rounded-lg border-2 border-dashed text-xl font-bold text-[#cfd8f0] ${isSel ? "border-[#e8c060] bg-[#e8c060]/20" : "border-[#5a6a9a] bg-white/5 hover:bg-white/10"}`}
                    >
                      +
                    </button>
                  );
                })
              )}
            </div>
            <p className="relative mt-2 text-center text-xs text-[#cfd8f0]">
              Tap a “+” launch pad, pick a module type, then launch. Tap a module to install instruments.
            </p>
          </div>

          <Panel className="mt-3" label="Station journal">
            <PanelTitle>Astronomy journal</PanelTitle>
            {station.journal.length === 0 ? (
              <p className="text-sm opacity-70">
                Install a telescope; later launches will log starfield sightings here.
              </p>
            ) : (
              <ul className="space-y-1 text-sm">
                {station.journal
                  .slice(-5)
                  .reverse()
                  .map((j) => (
                    <li key={j.id}>✦ {j.text}</li>
                  ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-3">
          <Panel label="Power">
            <PanelTitle>Power</PanelTitle>
            <div
              className="h-3 overflow-hidden rounded-full bg-black/10"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={power.provided}
              aria-valuenow={power.used}
              aria-label="Station power used"
            >
              <div
                className="h-full bg-[#e8c060]"
                style={{ width: `${Math.min(100, (power.used / Math.max(1, power.provided)) * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-xs opacity-80">
              {power.used} of {power.provided} used · instruments use 1 each · Solar Power adds 4
            </p>
            {flowerUnlocked && (
              <p className="mt-1 text-xs font-bold text-[#3f6a2a]">🌺 Orbital Bloom seeds unlocked for your backyard.</p>
            )}
          </Panel>

          {selModule && (
            <Panel label="Selected module">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-extrabold">{moduleName(selModule.definitionId)}</div>
                  <div className="text-xs opacity-70">
                    Pad {selModule.gx},{selModule.gy}
                  </div>
                </div>
                <button type="button" className="meadow-btn" onClick={cancel} aria-label="Deselect module">
                  ✕
                </button>
              </div>

              {selModule.definitionId === "core" ? (
                <p className="mt-2 text-sm opacity-80">The core anchors the station and supplies 2 power.</p>
              ) : (
                <>
                  <PanelTitle>Instruments</PanelTitle>
                  {selModule.instruments.some((i) => i.operational) ? (
                    <ul className="text-sm font-bold">
                      {selModule.instruments
                        .filter((i) => i.operational)
                        .map((i) => (
                          <li key={i.id}>
                            {INSTRUMENT_GLYPH[i.definitionId]} {INSTRUMENTS[i.definitionId].name} — operational
                          </li>
                        ))}
                    </ul>
                  ) : STATION_MODULES[selModule.definitionId as StationModuleDefId].instrumentSlots.length === 0 ? (
                    <p className="text-sm opacity-70">This module has no instrument slot.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {STATION_MODULES[selModule.definitionId as StationModuleDefId].instrumentSlots.map((iid) => {
                        const idef = INSTRUMENTS[iid];
                        const noPower = power.used + idef.powerCost > power.provided;
                        return (
                          <div key={iid}>
                            <button
                              type="button"
                              className="meadow-btn w-full text-left disabled:opacity-50"
                              disabled={noPower || busy}
                              onClick={() => doInstall(iid)}
                            >
                              <div className="text-sm">
                                {INSTRUMENT_GLYPH[iid]} Install {idef.name}
                              </div>
                              <ActionCost actions={1} cost={idef.cost} />
                            </button>
                            {noPower && (
                              <p className="mt-0.5 text-xs font-bold text-red-800">
                                Needs more power — launch a Solar Power Module first.
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <button
                    type="button"
                    className="meadow-btn mt-3 w-full disabled:opacity-50"
                    disabled={busy || (storeCheck ? !storeCheck.ok : false)}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const res = await storeStationModule(stationId, selModule.id);
                        if (res.ok) setSelModuleId(null);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Store module (free)
                  </button>
                  {storeCheck && !storeCheck.ok && (
                    <p className="mt-0.5 text-xs opacity-70">{storeCheck.error}</p>
                  )}
                </>
              )}
            </Panel>
          )}

          <Panel label="Launch a module">
            <PanelTitle>Launch a module</PanelTitle>
            <div className="grid gap-2">
              {Object.values(STATION_MODULES).map((def) => (
                <button
                  key={def.id}
                  type="button"
                  aria-pressed={placeDef === def.id}
                  className={`meadow-btn text-left ${placeDef === def.id ? "ring-4 ring-[#6b9e4a]" : ""}`}
                  onClick={() => setPlaceDef(placeDef === def.id ? null : def.id)}
                >
                  <div className="text-sm">
                    <span aria-hidden>{MODULE_LOOK[def.id].glyph}</span> {def.name}
                    {def.powerProvided > 0 && <span className="opacity-60"> · +{def.powerProvided} power</span>}
                  </div>
                  <ActionCost actions={1} cost={def.cost} />
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="meadow-btn"
                onClick={() => setRotation(nextRotation(rotation))}
                disabled={!placeDef}
              >
                Rotate ↻ {rotation}°
              </button>
              <button
                type="button"
                className="meadow-btn meadow-btn-primary disabled:opacity-50"
                disabled={!placeDef || !selCell || !attach?.ok || busy}
                onClick={doLaunchModule}
              >
                Launch 🚀
              </button>
            </div>
            <p className="mt-1 min-h-5 text-xs font-bold" aria-live="polite">
              {!placeDef
                ? "Choose a module type."
                : !selCell
                  ? "Now tap a “+” launch pad."
                  : attach?.ok
                    ? "Ports line up — ready to launch."
                    : <span className="text-red-800">{attach && !attach.ok ? attach.error : ""}</span>}
            </p>
          </Panel>

          {stored.length > 0 && (
            <Panel label="Stored modules">
              <PanelTitle>Stored modules</PanelTitle>
              <div className="flex flex-col gap-2">
                {stored.map((m) => {
                  const defId = m.definitionId as StationModuleDefId;
                  const ok =
                    selCell && validateModuleAttachment(station, defId, selCell.gx, selCell.gy, rotation, m.id).ok;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className="meadow-btn text-left disabled:opacity-50"
                      disabled={!selCell || !ok || busy}
                      onClick={async () => {
                        if (!selCell) return;
                        setBusy(true);
                        try {
                          const res = await restoreStationModule({
                            stationId,
                            moduleId: m.id,
                            gx: selCell.gx,
                            gy: selCell.gy,
                            rotation,
                          });
                          if (res.ok) setSelCell(null);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <div className="text-sm">Restore {moduleName(defId)} (free)</div>
                      <div className="text-[10px] font-medium opacity-60">
                        {selCell ? (ok ? "Fits the selected pad" : "Does not fit the selected pad") : "Select a launch pad first"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </SceneFrame>
  );
}

// ---------------------------------------------------------------------------
// 4. Expedition (7×7)
// ---------------------------------------------------------------------------

const BIOME_META: Record<BiomeFamily, { label: string; glyph: string; color: string }> = {
  forest: { label: "Forest", glyph: "🌲", color: "#6B9E4A" },
  cave: { label: "Cave", glyph: "🪨", color: "#9a9484" },
  river: { label: "River", glyph: "🌊", color: "#7EB8D4" },
  coastal: { label: "Coast", glyph: "🏖️", color: "#E8D4A0" },
};

type ExpeditionCellData = ExpeditionInstance["revealed"][number];

function ExpeditionGrid({
  biome,
  cells,
  party,
  choices,
  selectedId,
  onPick,
  disabled,
}: {
  biome: BiomeFamily;
  cells: ExpeditionCellData[] | null;
  party: { x: number; y: number };
  choices: ExpeditionChoice[];
  selectedId: string | null;
  onPick: (id: string) => void;
  disabled?: boolean;
}) {
  const { reducedMotion } = useGame();
  const size = EXPEDITION_MAP_SIZE;
  const meta = BIOME_META[biome];
  const byPos = new Map((cells ?? []).map((c) => [`${c.x},${c.y}`, c]));
  return (
    <div
      role="group"
      aria-label={`Expedition map, ${size} by ${size}`}
      className="mx-auto grid w-full max-w-[30rem] gap-[3px] rounded-xl border-4 border-[#4f6a3a] bg-[#4f6a3a] p-[3px] shadow-lg"
      style={{
        gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
        aspectRatio: "1 / 1",
      }}
    >
      {Array.from({ length: size * size }, (_, i) => {
        const x = i % size;
        const y = Math.floor(i / size);
        const cell = byPos.get(`${x},${y}`);
        const isParty = x === party.x && y === party.y;
        const revealed = isParty || Boolean(cell?.revealed);
        const optionIdx = choices.findIndex((c) => c.targetX === x && c.targetY === y);
        const option = optionIdx >= 0 ? choices[optionIdx] : undefined;
        const picked = option && option.id === selectedId;
        const encounter = cell?.encounterId
          ? ENCOUNTER_TEMPLATES.find((t) => t.id === cell.encounterId)
          : undefined;
        const bg = revealed ? meta.color : "#5b6070";
        const style = { background: bg };
        const content = (
          <>
            {isParty ? (
              <span className="text-xl" aria-hidden>
                🧭
              </span>
            ) : encounter ? (
              <span className="text-base" aria-hidden title={encounter.title}>
                ✦
              </span>
            ) : !revealed ? (
              <span className="text-xs opacity-40" aria-hidden>
                ?
              </span>
            ) : null}
            {option && (
              <span
                aria-hidden
                className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#f5e6c8] text-[10px] font-extrabold text-[#3a3020]"
              >
                {String.fromCharCode(65 + optionIdx)}
              </span>
            )}
          </>
        );
        const label = isParty
          ? "Your party"
          : option
            ? `Route ${String.fromCharCode(65 + optionIdx)}: ${option.label}`
            : encounter
              ? `${encounter.title} (explored)`
              : revealed
                ? "Explored ground"
                : "Fog";
        const cls = `relative flex items-center justify-center rounded-md border border-black/15 ${
          option
            ? `ring-4 ${picked ? "ring-[#e8c060]" : "ring-[#f5e6c8]/80"} ${!reducedMotion && !picked ? "animate-pulse" : ""}`
            : ""
        }`;
        if (option) {
          return (
            <button
              key={i}
              type="button"
              aria-label={label}
              aria-pressed={picked}
              disabled={disabled}
              onClick={() => onPick(option.id)}
              className={cls}
              style={style}
            >
              {content}
            </button>
          );
        }
        return (
          <div key={i} role="img" aria-label={label} className={cls} style={style}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

function ExpeditionView({ expeditionId }: { expeditionId: string }) {
  const {
    city,
    setSceneView,
    returnToCity,
    listRegions,
    previewChoices,
    dispatchExpedition,
    expeditionStep,
    recallExpedition,
    abandonExpedition,
  } = useGame();
  const confirm = useConfirm();
  const [regions, setRegions] = useState<ExpeditionRegion[] | null>(null);
  const [regionKey, setRegionKey] = useState<string | null>(null);
  const [choices, setChoices] = useState<ExpeditionChoice[]>([]);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const exp = city?.expansion.activeExpedition ?? null;
  const resumable = Boolean(exp && (exp.status === "active" || exp.status === "paused"));
  const showMap = Boolean(
    exp &&
      expeditionId !== "planning" &&
      exp.id === expeditionId &&
      (resumable || exp.status === "complete")
  );

  // Load nearby regions when planning.
  useEffect(() => {
    if (showMap) return;
    let cancelled = false;
    void listRegions().then((r) => {
      if (!cancelled) setRegions(r);
    });
    return () => {
      cancelled = true;
    };
  }, [showMap, listRegions]);

  // Load first-step choices for the picked region.
  useEffect(() => {
    if (!regionKey) {
      setChoices([]);
      setChosenId(null);
      return;
    }
    let cancelled = false;
    void previewChoices(regionKey).then((c) => {
      if (cancelled) return;
      setChoices(c);
      setChosenId(null);
    });
    return () => {
      cancelled = true;
    };
  }, [regionKey, previewChoices]);

  const cancel = useCallback(() => setChosenId(null), []);
  useEscape(cancel, Boolean(chosenId));

  if (!city) return <MissingScene what="expedition" />;

  const stepCost: CostMap = { happiness: EXPLORATION_HAPPINESS_COST };

  // ---------------- Active / completed map ----------------
  if (showMap && exp) {
    const complete = exp.status === "complete";
    const meta = BIOME_META[exp.biome];
    const lastReceipt = exp.rewards[exp.rewards.length - 1];
    const lastEncounter = exp.journal[exp.journal.length - 1];
    const chosen = exp.availableChoices.find((c) => c.id === chosenId);
    const party = city.expansion.party ?? [];

    const askStep = (choice: ExpeditionChoice) =>
      confirm.ask({
        title: `Take: ${choice.label}`,
        detail: choice.clue,
        actions: 1,
        cost: stepCost,
        confirmLabel: "Confirm step",
        run: async () => {
          const res = await expeditionStep(choice.id);
          if (res.ok) setChosenId(null);
        },
      });

    return (
      <SceneFrame
        title="Expedition"
        subtitle={`${meta.glyph} ${meta.label} outing · step ${exp.stepIndex}/${EXPEDITION_DECISIONS}${exp.status === "paused" ? " · resting" : ""}`}
        tone="trail"
        overlay={confirm.sheet}
      >
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_21rem]">
          <div>
            <ExpeditionGrid
              biome={exp.biome}
              cells={exp.revealed}
              party={{ x: exp.partyX, y: exp.partyY }}
              choices={complete ? [] : exp.availableChoices}
              selectedId={chosenId}
              onPick={(id) => setChosenId(id)}
              disabled={busy}
            />
            <div
              className="mx-auto mt-2 flex max-w-[30rem] justify-center gap-1.5"
              role="img"
              aria-label={`Step ${exp.stepIndex} of ${EXPEDITION_DECISIONS}`}
            >
              {Array.from({ length: EXPEDITION_DECISIONS }, (_, i) => (
                <span
                  key={i}
                  className={`h-2.5 w-8 rounded-full ${i < exp.stepIndex ? "bg-[#6b9e4a]" : "bg-black/15"}`}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {complete ? (
              <Panel label="Outing complete" className="border-2 border-[#6b9e4a]">
                <div className="font-extrabold">Outing complete — the party is home!</div>
                {exp.specialDiscovery && (
                  <p className="mt-1 text-sm">
                    Special find: <strong>{exp.specialDiscovery}</strong> (added to inventory)
                  </p>
                )}
                <button
                  type="button"
                  className="meadow-btn meadow-btn-primary mt-2 w-full"
                  onClick={() => setSceneView({ kind: "expedition", expeditionId: "planning" })}
                >
                  Plan another outing
                </button>
              </Panel>
            ) : (
              <Panel label="Choose a route">
                <PanelTitle>Choose a route</PanelTitle>
                {exp.status === "paused" && (
                  <p className="mb-2 text-xs opacity-80">The party is resting. Taking a step resumes the outing.</p>
                )}
                <div className="flex flex-col gap-2">
                  {exp.availableChoices.map((c, i) => (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={c.id === chosenId}
                      className={`meadow-btn text-left ${c.id === chosenId ? "ring-4 ring-[#e8c060]" : ""}`}
                      onClick={() => setChosenId(c.id === chosenId ? null : c.id)}
                    >
                      <div className="text-sm">
                        <span className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#3a3020] text-[11px] text-[#f5e6c8]">
                          {String.fromCharCode(65 + i)}
                        </span>
                        {c.label}
                      </div>
                      <div className="text-xs font-medium opacity-70">{c.clue}</div>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="meadow-btn meadow-btn-primary mt-3 min-h-[52px] w-full text-base disabled:opacity-50"
                  disabled={!chosen || busy}
                  onClick={() => chosen && askStep(chosen)}
                >
                  <span className="inline-flex flex-wrap items-center justify-center gap-1.5">
                    {chosen ? "Review step" : "Pick a route"}
                    <span className="text-xs font-medium opacity-80">
                      · <ActionCost actions={1} cost={stepCost} />
                    </span>
                  </span>
                </button>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="meadow-btn flex-1"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const res = await recallExpedition();
                        if (res.ok) returnToCity();
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Recall party (free)
                  </button>
                  <button
                    type="button"
                    className="meadow-btn flex-1"
                    disabled={busy}
                    onClick={() =>
                      confirm.ask({
                        title: "Abandon this outing?",
                        detail: "The party heads home without finishing. Rewards already earned are kept.",
                        actions: 0,
                        confirmLabel: "Abandon",
                        run: async () => {
                          const res = await abandonExpedition();
                          if (res.ok) setSceneView({ kind: "expedition", expeditionId: "planning" });
                        },
                      })
                    }
                  >
                    Abandon
                  </button>
                </div>
              </Panel>
            )}

            <Panel label="Finds">
              <PanelTitle>Finds so far</PanelTitle>
              {exp.rewards.length === 0 ? (
                <p className="text-sm opacity-70">Nothing yet.</p>
              ) : (
                <ol className="space-y-1.5 text-sm">
                  {exp.rewards.map((r) => (
                    <li key={r.choiceId} className="flex flex-wrap items-center gap-x-2">
                      <span className="font-extrabold">{r.stepIndex + 1}.</span>
                      <ResourceCostLine amounts={r.resources} prefix="+" />
                      {r.discovery && <span className="text-xs opacity-80">✦ {r.discovery}</span>}
                    </li>
                  ))}
                </ol>
              )}
              {lastReceipt && lastEncounter && (
                <p className="mt-2 border-t border-black/10 pt-2 text-xs opacity-80">{lastEncounter.text}</p>
              )}
            </Panel>

            {party.length > 0 && (
              <Panel label="Party">
                <PanelTitle>Party</PanelTitle>
                <ul className="flex flex-wrap gap-1.5 text-sm font-bold">
                  {party.map((m) => (
                    <li key={m.id} className="meadow-chip">
                      {m.name} <span className="text-xs font-medium opacity-60">{m.role}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>
        </div>
      </SceneFrame>
    );
  }

  // ---------------- Planning ----------------
  const region = regions?.find((r) => r.chunkKey === regionKey);
  const picked = choices.find((c) => c.id === chosenId);
  const startX = Math.floor(EXPEDITION_MAP_SIZE / 2);
  const startY = EXPEDITION_MAP_SIZE - 1;

  const askDispatch = () => {
    if (!region || !picked) return;
    confirm.ask({
      title: `Send the party to the ${BIOME_META[region.biome].label.toLowerCase()}`,
      detail: `First route: ${picked.label}. ${EXPEDITION_DECISIONS} decisions total; each later step costs the same.`,
      actions: 1,
      cost: stepCost,
      confirmLabel: "Send party",
      run: async () => {
        await dispatchExpedition(region.chunkKey, picked.id);
      },
    });
  };

  return (
    <SceneFrame
      title="Explore"
      subtitle={`A short outing: ${EXPEDITION_DECISIONS} decisions, each 1 action + ${EXPLORATION_HAPPINESS_COST} happiness`}
      tone="trail"
      overlay={confirm.sheet}
    >
      {resumable && exp ? (
        <Panel label="Outing in progress" className="mx-auto max-w-md">
          <div className="font-extrabold">An outing is already underway</div>
          <p className="mt-1 text-sm opacity-80">
            Step {exp.stepIndex}/{EXPEDITION_DECISIONS} in the {BIOME_META[exp.biome].label.toLowerCase()}. Finish or
            abandon it before starting another.
          </p>
          <button
            type="button"
            className="meadow-btn meadow-btn-primary mt-3 w-full"
            onClick={() => setSceneView({ kind: "expedition", expeditionId: exp.id })}
          >
            Resume outing
          </button>
        </Panel>
      ) : (
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_21rem]">
          <div>
            <ExpeditionGrid
              biome={region?.biome ?? "forest"}
              cells={null}
              party={{ x: startX, y: startY }}
              choices={region ? choices : []}
              selectedId={chosenId}
              onPick={(id) => setChosenId(id)}
            />
            <p className="mt-2 text-center text-xs opacity-70">
              {region
                ? "Tap A or B on the map (or below) to pick the first route."
                : "Pick a region to preview your first routes."}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Panel label="Regions">
              <PanelTitle>Regions</PanelTitle>
              {regions === null ? (
                <p className="text-sm opacity-70">Scouting…</p>
              ) : regions.length === 0 ? (
                <p className="text-sm opacity-70">No regions in range yet — build a little further out.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {regions.map((r) => {
                    const m = BIOME_META[r.biome];
                    const on = r.chunkKey === regionKey;
                    return (
                      <button
                        key={r.chunkKey}
                        type="button"
                        aria-pressed={on}
                        className={`meadow-btn text-left ${on ? "ring-4 ring-[#6b9e4a]" : ""}`}
                        onClick={() => setRegionKey(on ? null : r.chunkKey)}
                      >
                        <div className="text-sm">
                          <span aria-hidden>{m.glyph}</span> {m.label}
                        </div>
                        <div className="text-[10px] font-medium opacity-60">
                          {r.chunkKey} · {r.surveyed ? "surveyed" : r.claimed ? "claimed" : "uncharted"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Panel>

            {region && (
              <Panel label="First route">
                <PanelTitle>First route</PanelTitle>
                <div className="flex flex-col gap-2">
                  {choices.map((c, i) => (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={c.id === chosenId}
                      className={`meadow-btn text-left ${c.id === chosenId ? "ring-4 ring-[#e8c060]" : ""}`}
                      onClick={() => setChosenId(c.id === chosenId ? null : c.id)}
                    >
                      <div className="text-sm">
                        <span className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#3a3020] text-[11px] text-[#f5e6c8]">
                          {String.fromCharCode(65 + i)}
                        </span>
                        {c.label}
                      </div>
                      <div className="text-xs font-medium opacity-70">{c.clue}</div>
                    </button>
                  ))}
                  {choices.length === 0 && <p className="text-sm opacity-70">Looking for routes…</p>}
                </div>
                <button
                  type="button"
                  className="meadow-btn meadow-btn-primary mt-3 min-h-[52px] w-full text-base disabled:opacity-50"
                  disabled={!picked || busy}
                  onClick={askDispatch}
                >
                  <span className="inline-flex flex-wrap items-center justify-center gap-1.5">
                    {picked ? "Review dispatch" : "Pick a route"}
                    <span className="text-xs font-medium opacity-80">
                      · <ActionCost actions={1} cost={stepCost} />
                    </span>
                  </span>
                </button>
              </Panel>
            )}
          </div>
        </div>
      )}
    </SceneFrame>
  );
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function ExpansionScenes() {
  const { sceneView } = useGame();
  let view: ReactNode = null;
  switch (sceneView.kind) {
    case "interior":
      view = (
        <InteriorView
          key={sceneView.sceneId}
          sceneId={sceneView.sceneId}
          houseEntityId={sceneView.houseEntityId}
        />
      );
      break;
    case "backyard":
      view = (
        <BackyardView
          key={sceneView.sceneId}
          sceneId={sceneView.sceneId}
          houseEntityId={sceneView.houseEntityId}
        />
      );
      break;
    case "station":
      view = <StationView key={sceneView.stationId} stationId={sceneView.stationId} />;
      break;
    case "expedition":
      view = <ExpeditionView key={sceneView.expeditionId} expeditionId={sceneView.expeditionId} />;
      break;
    default:
      return null;
  }
  return (
    <>
      {view}
      <LaunchOverlay />
    </>
  );
}
