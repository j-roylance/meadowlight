"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BUILDING_TIPS,
  PROJECTS,
  getBuilding,
} from "@/game/catalog/definitions";
import {
  rotateWorld,
  unrotateWorld,
  screenToWorld,
  tileKey,
  type ViewRotation,
} from "@/game/simulation/coords";
import { occupiedTiles } from "@/game/simulation/placement";
import { resolveTerrain } from "@/game/simulation/terrain";
import { roadMask, roadSet } from "@/game/simulation/roads";
import { isBankEntity } from "@/game/simulation/bank";
import { isSpaceCenterEntity } from "@/game/simulation/spaceCenter";
import type { CityState, PlacedEntity, ToolMode, WorldCoord } from "@/game/types";
import { ClickableHintIcon } from "@/components/ClickableHint";
import {
  BuildingArt,
  RoadTileArt,
  StonePileProp,
  TerrainTile,
  TreeProp,
  TW,
  TH,
} from "./buildings";
import { palette } from "./palette";
import { TownWalkers } from "./TownWalkers";
import { buildWalkerRoutes, walkerCount } from "./walkers";

function entityClickTip(e: PlacedEntity): string | null {
  if (isBankEntity(e)) return "Click to exchange resources";
  if (isSpaceCenterEntity(e)) return "Click to launch or enter station";
  if (e.definitionId === "portal") return "Click to send resources or work";
  if (
    e.definitionId === "project_site" &&
    e.appearance?.stage !== "complete"
  ) {
    return "Click to contribute materials";
  }
  return null;
}

function entityTooltip(e: PlacedEntity): string {
  const click = entityClickTip(e);
  let tip = BUILDING_TIPS[e.definitionId];
  if (isBankEntity(e)) {
    tip = BUILDING_TIPS.landmark_bank;
  } else if (isSpaceCenterEntity(e)) {
    tip = BUILDING_TIPS.space_center;
  } else if (
    e.definitionId === "project_site" &&
    e.appearance?.stage === "complete" &&
    e.appearance.projectType
  ) {
    const blueprint = PROJECTS[e.appearance.projectType]?.landmarkBlueprint;
    if (blueprint) tip = BUILDING_TIPS[blueprint] ?? tip;
  }
  if (click && tip) return `${tip} ${click}.`;
  return tip ?? click ?? e.definitionId.replaceAll("_", " ");
}

interface Props {
  city: CityState;
  readOnly?: boolean;
  tool: ToolMode;
  buildDefId?: string;
  ghostValid?: boolean;
  ghostReason?: ReactNode;
  roadPreview?: WorldCoord[];
  selectedEntityId?: string | null;
  onTileClick?: (x: bigint, y: bigint) => void;
  onTileHover?: (x: bigint, y: bigint) => void;
  onEntityClick?: (entity: PlacedEntity) => void;
  reducedMotion?: boolean;
  /** Decorative / login backdrop: no pan/zoom/click. */
  interactive?: boolean;
  initialCam?: { x: number; y: number; zoom: number };
}

function viewPos(wx: number, wy: number, rot: ViewRotation) {
  const v = rotateWorld(wx, wy, rot);
  return {
    sx: (v.x - v.y) * (TW / 2),
    sy: (v.x + v.y) * (TH / 2),
    vx: v.x,
    vy: v.y,
  };
}

/** NW-most footprint tile in view space — draw origin for multi-tile buildings. */
function entityDrawPos(
  e: PlacedEntity,
  rot: ViewRotation
): { sx: number; sy: number; depth: number } {
  const def = getBuilding(e.definitionId);
  let bestVx = 0;
  let bestVy = 0;
  let bestSum = Infinity;
  for (let dx = 0; dx < def.footprint.w; dx++) {
    for (let dy = 0; dy < def.footprint.h; dy++) {
      const v = rotateWorld(Number(e.x) + dx, Number(e.y) + dy, rot);
      const sum = v.x + v.y;
      if (sum < bestSum) {
        bestSum = sum;
        bestVx = v.x;
        bestVy = v.y;
      }
    }
  }
  return {
    sx: (bestVx - bestVy) * (TW / 2),
    sy: (bestVx + bestVy) * (TH / 2),
    depth: bestSum,
  };
}

function collectVisibleTiles(
  city: CityState,
  camX: number,
  camY: number,
  size: { w: number; h: number },
  zoom: number,
  rot: ViewRotation
) {
  const z = Math.max(0.4, zoom);
  const margin = 80;
  const halfW = size.w / (2 * z) + margin;
  const halfH = size.h / (2 * z) + margin;
  const maxR = Math.min(36, Math.ceil(halfW / 32 + halfH / 16) + 2);

  const list: { x: bigint; y: bigint; kind: string; depth: number }[] = [];
  const camV = rotateWorld(camX, camY, rot);
  const ox = Math.floor(camV.x);
  const oy = Math.floor(camV.y);

  for (let dx = -maxR; dx <= maxR; dx++) {
    for (let dy = -maxR; dy <= maxR; dy++) {
      const sx = (dx - dy) * (TW / 2);
      const sy = (dx + dy) * (TH / 2);
      if (Math.abs(sx) > halfW || Math.abs(sy) > halfH) continue;
      // View-space tile → world
      const world = unrotateWorld(ox + dx, oy + dy, rot);
      const x = BigInt(Math.round(world.x));
      const y = BigInt(Math.round(world.y));
      const v = rotateWorld(Number(x), Number(y), rot);
      list.push({
        x,
        y,
        kind: resolveTerrain(city, x, y),
        depth: v.x + v.y,
      });
    }
  }
  list.sort((a, b) => a.depth - b.depth);
  return list;
}

export function MapViewport({
  city,
  readOnly,
  tool,
  buildDefId,
  ghostValid,
  ghostReason,
  roadPreview = [],
  selectedEntityId,
  onTileClick,
  onTileHover,
  onEntityClick,
  reducedMotion,
  interactive = true,
  initialCam,
}: Props) {
  const startCam = initialCam ?? { x: 2, y: 2, zoom: 1 };
  const containerRef = useRef<HTMLDivElement>(null);
  const worldGroupRef = useRef<SVGGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const camRef = useRef({ ...startCam });
  const rotRef = useRef<ViewRotation>(0);
  const [cam, setCam] = useState({ ...startCam });
  const [rot, setRot] = useState<ViewRotation>(0);
  const [hover, setHover] = useState<{ x: bigint; y: bigint } | null>(null);
  const drag = useRef<{
    active: boolean;
    moved: boolean;
    sx: number;
    sy: number;
    cx: number;
    cy: number;
  } | null>(null);
  const lastTileCam = useRef({ ...startCam, rot: 0 as ViewRotation });
  const rebaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const applyWorldTransform = useCallback(
    (c: { x: number; y: number; zoom: number }, r: ViewRotation, w: number, h: number) => {
      const g = worldGroupRef.current;
      if (!g) return;
      const cv = rotateWorld(c.x, c.y, r);
      const cox = (cv.x - cv.y) * (TW / 2);
      const coy = (cv.x + cv.y) * (TH / 2);
      g.setAttribute(
        "transform",
        `translate(${w / 2}, ${h / 2}) scale(${c.zoom}) translate(${-cox}, ${-coy})`
      );
    },
    []
  );

  useEffect(() => {
    rotRef.current = rot;
    applyWorldTransform(cam, rot, size.w, size.h);
  }, [cam, rot, size, applyWorldTransform]);

  const roads = useMemo(() => roadSet(city.roads), [city.roads]);
  const occupied = useMemo(() => occupiedTiles(city), [city]);

  const tiles = useMemo(
    () => collectVisibleTiles(city, cam.x, cam.y, size, cam.zoom, rot),
    // terrainOverrides must invalidate when harvest clears tiles
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cam.x, cam.y, cam.zoom, rot, size.w, size.h, city.seed, city.generatorVersion, city.terrainOverrides]
  );

  const entitiesSorted = useMemo(() => {
    return [...city.entities].filter((e) => !e.stored);
  }, [city.entities]);

  // Routes only rebuild when buildings/happiness/rotation change — motion is SMIL (0 continuous JS).
  const walkerRoutes = useMemo(() => {
    const n = walkerCount(city);
    return buildWalkerRoutes(city, rot, n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city.entities, city.economy.happiness, rot]);

  const depthSorted = useMemo(() => {
    type Item =
      | { kind: "tree"; key: string; depth: number; x: number; y: number }
      | { kind: "stone_pile"; key: string; depth: number; x: number; y: number }
      | { kind: "entity"; key: string; depth: number; entity: PlacedEntity; draw: { sx: number; sy: number } };

    const footprints = entitiesSorted.map((e) => {
      const def = getBuilding(e.definitionId);
      const x = Number(e.x);
      const y = Number(e.y);
      const draw = entityDrawPos(e, rot);
      // Front depth in view space for occlusion bumps
      let front = -Infinity;
      let back = Infinity;
      for (let dx = 0; dx < def.footprint.w; dx++) {
        for (let dy = 0; dy < def.footprint.h; dy++) {
          const v = rotateWorld(x + dx, y + dy, rot);
          const sum = v.x + v.y;
          front = Math.max(front, sum);
          back = Math.min(back, sum);
        }
      }
      return { entity: e, x, y, w: def.footprint.w, h: def.footprint.h, back, front, draw };
    });

    const items: Item[] = [];

    for (const t of tiles) {
      if (t.kind !== "tree" && t.kind !== "stone_pile") continue;
      const k = tileKey(t.x, t.y);
      if (occupied.has(k) || roads.has(k)) continue;
      const xi = Number(t.x);
      const yi = Number(t.y);
      const tv = rotateWorld(xi, yi, rot);
      let depth = tv.x + tv.y;

      for (const f of footprints) {
        const nearX = xi >= f.x - 1 && xi <= f.x + f.w;
        const nearY = yi >= f.y - 1 && yi <= f.y + f.h;
        if (!nearX || !nearY) continue;
        // Only bump props truly in front of the building. Bumping anything
        // with depth >= back pulled north/side stones over tall landmarks.
        if (tv.x + tv.y <= f.front) continue;
        depth = Math.max(depth, f.front + 0.5);
      }

      if (t.kind === "tree") {
        items.push({ kind: "tree", key: `tree-${k}`, depth, x: xi, y: yi });
      } else {
        items.push({ kind: "stone_pile", key: `stone-${k}`, depth, x: xi, y: yi });
      }
    }

    for (const f of footprints) {
      items.push({
        kind: "entity",
        key: f.entity.id,
        depth: f.front,
        entity: f.entity,
        draw: { sx: f.draw.sx, sy: f.draw.sy },
      });
    }

    items.sort((a, b) => a.depth - b.depth || (a.kind === "entity" ? -1 : 1));
    return items;
  }, [tiles, occupied, roads, entitiesSorted, rot]);

  const pickTile = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el) return null;
      const c = camRef.current;
      const r = rotRef.current;
      const rect = el.getBoundingClientRect();
      const sx = (clientX - rect.left - size.w / 2) / c.zoom;
      const sy = (clientY - rect.top - size.h / 2) / c.zoom;
      // Screen → view-space relative to rotated camera, then unrotate to world.
      const camV = rotateWorld(c.x, c.y, r);
      const { wx: viewX, wy: viewY } = screenToWorld(sx, sy, camV.x, camV.y, TW, TH);
      const world = unrotateWorld(viewX, viewY, r);
      return { x: BigInt(Math.floor(world.x)), y: BigInt(Math.floor(world.y)) };
    },
    [size]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    const c = camRef.current;
    drag.current = {
      active: true,
      moved: false,
      sx: e.clientX,
      sy: e.clientY,
      cx: c.x,
      cy: c.y,
    };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!interactive) return;
    if (!drag.current?.active) {
      if (
        tool === "build" ||
        tool === "portal" ||
        tool === "project" ||
        tool === "road" ||
        tool === "erase_road" ||
        tool === "inspect"
      ) {
        const t = pickTile(e.clientX, e.clientY);
        if (t) {
          setHover((prev) => (prev && prev.x === t.x && prev.y === t.y ? prev : t));
          onTileHover?.(t.x, t.y);
        }
      }
      return;
    }

    const dx = e.clientX - drag.current.sx;
    const dy = e.clientY - drag.current.sy;
    if (Math.abs(dx) + Math.abs(dy) > 6) drag.current.moved = true;

    const zoom = camRef.current.zoom;
    const r = rotRef.current;
    // Screen delta → view-space ortho delta → unrotate to world cam delta
    const viewDx = dx / zoom / 32;
    const viewDy = dy / zoom / 16;
    const viewMoveX = -(viewDx + viewDy) / 2;
    const viewMoveY = -(viewDy - viewDx) / 2;
    const worldMove = unrotateWorld(viewMoveX, viewMoveY, r);
    const next = {
      x: drag.current.cx + worldMove.x,
      y: drag.current.cy + worldMove.y,
      zoom,
    };
    camRef.current = next;
    applyWorldTransform(next, r, size.w, size.h);

    const lt = lastTileCam.current;
    const drifted =
      Math.abs(next.x - lt.x) > 2.5 ||
      Math.abs(next.y - lt.y) > 2.5 ||
      next.zoom !== lt.zoom ||
      r !== lt.rot;
    if (drifted && rebaseTimer.current == null) {
      rebaseTimer.current = setTimeout(() => {
        rebaseTimer.current = null;
        lastTileCam.current = {
          ...camRef.current,
          rot: rotRef.current,
        };
        setCam({ ...camRef.current });
      }, 120);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!interactive) return;
    const d = drag.current;
    drag.current = null;
    if (rebaseTimer.current != null) {
      clearTimeout(rebaseTimer.current);
      rebaseTimer.current = null;
    }
    lastTileCam.current = { ...camRef.current, rot: rotRef.current };
    setCam({ ...camRef.current });

    if (!d || d.moved) return;
    const t = pickTile(e.clientX, e.clientY);
    if (!t) return;
    const ent = entitiesSorted.find((entity) => {
      const def = getBuilding(entity.definitionId);
      for (let ox = 0; ox < def.footprint.w; ox++) {
        for (let oy = 0; oy < def.footprint.h; oy++) {
          if (entity.x + BigInt(ox) === t.x && entity.y + BigInt(oy) === t.y) return true;
        }
      }
      return false;
    });
    // Occupied tiles: always select the building. Placement tools would only
    // fail here ("occupied" / "no actions") — selecting lets you contribute
    // to a project site without spending an action.
    if (
      ent &&
      (tool === "inspect" ||
        tool === "move" ||
        tool === "store" ||
        tool === "build" ||
        tool === "portal" ||
        tool === "project")
    ) {
      onEntityClick?.(ent);
    } else {
      onTileClick?.(t.x, t.y);
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!interactive) return;
    e.preventDefault();
    const nextZoom = Math.min(
      2.2,
      Math.max(0.45, camRef.current.zoom * (e.deltaY > 0 ? 0.9 : 1.1))
    );
    const next = { ...camRef.current, zoom: nextZoom };
    camRef.current = next;
    applyWorldTransform(next, rotRef.current, size.w, size.h);
    setCam(next);
  };

  const jumpTo = (x: number, y: number) => {
    const next = { ...camRef.current, x, y };
    camRef.current = next;
    applyWorldTransform(next, rotRef.current, size.w, size.h);
    setCam(next);
  };

  const setZoom = (factor: number) => {
    const next = {
      ...camRef.current,
      zoom: Math.min(2.2, Math.max(0.45, camRef.current.zoom * factor)),
    };
    camRef.current = next;
    applyWorldTransform(next, rotRef.current, size.w, size.h);
    setCam(next);
  };

  const rotateBy = (delta: 1 | 3) => {
    const nextRot = ((rotRef.current + delta) % 4) as ViewRotation;
    rotRef.current = nextRot;
    applyWorldTransform(camRef.current, nextRot, size.w, size.h);
    lastTileCam.current = { ...camRef.current, rot: nextRot };
    setRot(nextRot);
  };

  const ghostPos = hover;
  const ghostDef = buildDefId ? getBuilding(buildDefId) : null;
  const ghostDraw =
    ghostPos && ghostDef
      ? entityDrawPos(
          {
            id: "ghost",
            definitionId: ghostDef.id,
            level: 1,
            x: ghostPos.x,
            y: ghostPos.y,
            rotation: 0,
            stored: false,
            revision: 1,
          },
          rot
        )
      : null;

  return (
    <div className="relative h-full w-full overflow-hidden select-none touch-none" ref={containerRef}>
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, #B8D4E8 0%, #D4E8C8 35%, ${palette.creamDeep} 100%)`,
        }}
      />

      <svg
        width={size.w}
        height={size.h}
        className="absolute inset-0"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        role="img"
        aria-label="City map"
      >
        <defs>
          <g id="ml-terrain-grass">
            <TerrainTile kind="grass" />
          </g>
          <g id="ml-terrain-grass_flowers">
            <TerrainTile kind="grass_flowers" />
          </g>
          <g id="ml-terrain-water">
            <TerrainTile kind="water" />
          </g>
          <g id="ml-terrain-sand">
            <TerrainTile kind="sand" />
          </g>
          <g id="ml-terrain-tree">
            <TerrainTile kind="tree" />
          </g>
          <g id="ml-terrain-stone_pile">
            <TerrainTile kind="stone_pile" />
          </g>
          <g id="ml-terrain-path">
            <TerrainTile kind="path" />
          </g>
          <g id="ml-tree-prop">
            <TreeProp />
          </g>
          <g id="ml-stone-pile-prop">
            <StonePileProp />
          </g>
        </defs>

        <g ref={worldGroupRef}>
          {tiles.map((t) => {
            const { sx, sy } = viewPos(Number(t.x), Number(t.y), rot);
            const isRoad = roads.has(tileKey(t.x, t.y));
            if (isRoad) {
              return (
                <g key={tileKey(t.x, t.y)} transform={`translate(${sx}, ${sy})`}>
                  <RoadTileArt {...roadMask(t.x, t.y, roads)} />
                </g>
              );
            }
            return (
              <use
                key={`${tileKey(t.x, t.y)}-${rot}`}
                href={`#ml-terrain-${t.kind}`}
                x={sx}
                y={sy}
              />
            );
          })}

          {roadPreview.map((t) => {
            const { sx, sy } = viewPos(Number(t.x), Number(t.y), rot);
            return (
              <g key={`rp-${tileKey(t.x, t.y)}`} transform={`translate(${sx}, ${sy})`} opacity={0.7}>
                <use href="#ml-terrain-path" />
                <ellipse cx={0} cy={14} rx={14} ry={7} fill={palette.pathDirt} opacity={0.8} />
              </g>
            );
          })}

          {depthSorted.map((item) => {
            if (item.kind === "tree") {
              const { sx, sy } = viewPos(item.x, item.y, rot);
              return (
                <g key={item.key} transform={`translate(${sx}, ${sy})`}>
                  <title>Click to harvest wood (1 action)</title>
                  <use href="#ml-tree-prop" x={0} y={0} />
                </g>
              );
            }
            if (item.kind === "stone_pile") {
              const { sx, sy } = viewPos(item.x, item.y, rot);
              return (
                <g key={item.key} transform={`translate(${sx}, ${sy})`}>
                  <title>Click to harvest stone (1 action)</title>
                  <use href="#ml-stone-pile-prop" x={0} y={0} />
                </g>
              );
            }
            const e = item.entity;
            const selected = e.id === selectedEntityId;
            const clickTip = entityClickTip(e);
            return (
              <g key={item.key} transform={`translate(${item.draw.sx}, ${item.draw.sy})`}>
                <title>{entityTooltip(e)}</title>
                {selected && (
                  <ellipse
                    cx={0}
                    cy={20}
                    rx={28}
                    ry={12}
                    fill="none"
                    stroke="#F0C060"
                    strokeWidth={3}
                    opacity={0.9}
                  />
                )}
                <BuildingArt
                  definitionId={e.definitionId}
                  level={e.level}
                  stage={e.appearance?.stage}
                  projectType={e.appearance?.projectType}
                />
                {clickTip && !readOnly && (
                  <g transform="translate(18, -36)">
                    <ClickableHintIcon size={14} title={clickTip} />
                  </g>
                )}
              </g>
            );
          })}

          <TownWalkers routes={walkerRoutes} reducedMotion={reducedMotion} />

          {ghostPos && ghostDef && ghostDraw && (tool === "build" || tool === "portal" || tool === "project") && !readOnly && (
            <g transform={`translate(${ghostDraw.sx}, ${ghostDraw.sy})`} opacity={0.55}>
              <BuildingArt definitionId={ghostDef.id} />
              <ellipse
                cx={0}
                cy={18}
                rx={20}
                ry={9}
                fill={ghostValid ? "#6BC46A" : "#D46050"}
                opacity={0.45}
              />
            </g>
          )}
        </g>
      </svg>

      {interactive && (
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
          <button type="button" className="meadow-btn" onClick={() => jumpTo(1, 1)} aria-label="Jump to town hall">
            Town hall
          </button>
          <button type="button" className="meadow-btn" onClick={() => setZoom(1.15)} aria-label="Zoom in">
            +
          </button>
          <button type="button" className="meadow-btn" onClick={() => setZoom(0.87)} aria-label="Zoom out">
            −
          </button>
          <button
            type="button"
            className="meadow-btn"
            onClick={() => rotateBy(3)}
            aria-label="Rotate view 90 degrees left"
            title="Rotate view 90° left"
          >
            Rotate L
          </button>
          <button
            type="button"
            className="meadow-btn"
            onClick={() => rotateBy(1)}
            aria-label="Rotate view 90 degrees right"
            title="Rotate view 90° right"
          >
            Rotate R
          </button>
        </div>
      )}

      {interactive && ghostReason && (tool === "inspect" ? hover : ghostPos) && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 meadow-chip max-w-[90%] text-sm">
          {ghostReason}
        </div>
      )}

      {interactive && readOnly && (
        <div className="absolute top-3 left-3 meadow-chip bg-amber-100/90 text-amber-950">
          Visiting — read only
        </div>
      )}
    </div>
  );
}
