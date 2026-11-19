"use client";

import { useEffect, useMemo, useState } from "react";
import type { CityState } from "@/game/types";
import { rotateWorld, unrotateWorld, tileKey } from "@/game/simulation/coords";
import type { ViewRotation } from "@/game/simulation/coords";
import { resolveWorldSample } from "@/game/simulation/terrain";
import { roadSet } from "@/game/simulation/roads";
import { occupiedTiles } from "@/game/simulation/placement";
import { biomeSideMat, biomeTopMat, type BlockMat } from "./voxelPalette";
import { InstancedBlocks, type InstanceSpec } from "./InstancedBlocks";
import { terrainY, tileToWorld } from "./voxelScale";
import { PropsLayer, propVariant, type PropPlacement } from "./mesh/PropMeshes";

/** Rebuild after this much pan (tiles). Keep small so the disk tracks the lens. */
const CAM_REBASE_TILES = 3;
/**
 * Fixed ground radius (tiles from camera). Large enough that zoom 1 on a
 * widescreen still has headroom to zoom out a notch, without being retied to
 * the lens every frame (that clamp is what made zoom feel broken).
 */
export const TERRAIN_RADIUS = 88;
/** Ortho half-height at zoom 1 (~2× the original 16). */
export const VIEW_SIZE_AT_ZOOM_1 = 32;
export const ZOOM_MAX = 2.2;
export const ZOOM_MIN_FLOOR = 0.45;
/**
 * Iso camera sits at 45° — the ground footprint is a diamond vs our axis-aligned
 * tile square, so usable ortho extent is smaller than TERRAIN_RADIUS.
 */
const ISO_FOOTPRINT_SLACK = 1.35;

/** Half-height of the ortho window for a given zoom (1:1 with zoom — no extra clamp). */
export function viewSizeForZoom(zoom: number): number {
  return VIEW_SIZE_AT_ZOOM_1 / Math.max(ZOOM_MIN_FLOOR, zoom);
}

/** Max ortho half-extent that still fits inside the terrain square for this aspect. */
function maxViewSizeForAspect(aspect: number): number {
  const maxExtent =
    (TERRAIN_RADIUS - CAM_REBASE_TILES - 4) / ISO_FOOTPRINT_SLACK;
  return Math.max(8, Math.min(maxExtent, maxExtent / Math.max(1, aspect)));
}

/**
 * Most zoomed-out zoom that keeps the lens inside the terrain square.
 * Wider monitors get a slightly higher floor so edges stay filled.
 */
export function minZoomForAspect(aspect: number): number {
  const z = VIEW_SIZE_AT_ZOOM_1 / maxViewSizeForAspect(aspect);
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN_FLOOR, z));
}

export function clampZoom(zoom: number, aspect: number): number {
  return Math.min(ZOOM_MAX, Math.max(minZoomForAspect(aspect), zoom));
}

/** @deprecated alias — terrain radius is fixed now. */
export function terrainRadiusForView(_zoom?: number, _aspect?: number): number {
  return TERRAIN_RADIUS;
}

function collectVisibleWorldTiles(
  camX: number,
  camY: number,
  rot: ViewRotation,
  radius: number
): { x: bigint; y: bigint; dx: number; dy: number }[] {
  const camV = rotateWorld(camX, camY, rot);
  const ox = Math.floor(camV.x);
  const oy = Math.floor(camV.y);
  const list: { x: bigint; y: bigint; dx: number; dy: number }[] = [];
  // Full square — matches the ortho lens corners so edge land/trees aren't missing.
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const world = unrotateWorld(ox + dx, oy + dy, rot);
      list.push({
        x: BigInt(Math.round(world.x)),
        y: BigInt(Math.round(world.y)),
        dx,
        dy,
      });
    }
  }
  return list;
}

/**
 * Voxel terrain columns + mesh props (trees / stone / flowers).
 * Camera pan is continuous; the tile set only rebases after meaningful drift.
 */
export function TerrainLayer({
  city,
  camX,
  camY,
  rot,
  zoom = 1,
  selectedHarvest,
}: {
  city: CityState;
  camX: number;
  camY: number;
  rot: ViewRotation;
  zoom?: number;
  selectedHarvest?: { x: bigint; y: bigint; kind: "tree" | "stone_pile" } | null;
}) {
  void zoom; // reserved for LOD; ground radius stays fixed so zoom feels responsive
  const radius = TERRAIN_RADIUS;

  const [tileCam, setTileCam] = useState({ x: camX, y: camY, rot });

  useEffect(() => {
    const drifted =
      Math.abs(camX - tileCam.x) >= CAM_REBASE_TILES ||
      Math.abs(camY - tileCam.y) >= CAM_REBASE_TILES ||
      rot !== tileCam.rot;
    if (drifted) setTileCam({ x: camX, y: camY, rot });
  }, [camX, camY, rot, tileCam.x, tileCam.y, tileCam.rot]);

  const roads = useMemo(() => roadSet(city.roads), [city.roads]);
  const occupied = useMemo(() => occupiedTiles(city), [city]);

  const { ground, props } = useMemo(() => {
    const tiles = collectVisibleWorldTiles(tileCam.x, tileCam.y, tileCam.rot, radius);
    const groundInst: InstanceSpec[] = [];
    const propList: PropPlacement[] = [];

    for (const t of tiles) {
      const sample = resolveWorldSample(city, t.x, t.y);
      const wx = Number(t.x);
      const wz = Number(t.y);
      const key = tileKey(t.x, t.y);
      const isRoad = roads.has(key);
      const h = sample.kind === "water" ? 0 : sample.height;
      const x = tileToWorld(wx);
      const z = tileToWorld(wz);

      if (sample.kind === "water") {
        groundInst.push({ x, y: 0, z, mat: "water", sy: 0.55, sx: 0.98, sz: 0.98 });
        continue;
      }

      const top: BlockMat = isRoad ? "path" : biomeTopMat(sample.biome);
      const side = biomeSideMat(sample.biome);
      const surfaceY = terrainY(h);

      // Surface cube at terrain height. Column underneath when h>=1 so iso sides aren't hollow.
      groundInst.push({
        x,
        y: surfaceY,
        z,
        mat: top,
        sx: 0.98,
        sy: 0.98,
        sz: 0.98,
      });
      if (h >= 1) {
        groundInst.push({
          x,
          y: 0,
          z,
          mat: side,
          sx: 0.96,
          sy: Math.max(0.5, h - 0.02),
          sz: 0.96,
        });
      }

      // Props across the full visible terrain — same radius as ground.
      if (isRoad || occupied.has(key)) continue;
      const topY = surfaceY + 1;
      const selected =
        Boolean(selectedHarvest) &&
        selectedHarvest!.x === t.x &&
        selectedHarvest!.y === t.y;

      if (
        sample.kind === "tree" ||
        sample.kind === "stone_pile" ||
        sample.kind === "grass_flowers"
      ) {
        const vKey = `${city.seed}:${key}:${sample.kind}`;
        propList.push({
          key: `${key}-${sample.kind}`,
          kind: sample.kind,
          x,
          y: topY,
          z,
          variant: propVariant(vKey, 5),
          yaw: (propVariant(vKey + ":yaw", 8) / 8) * Math.PI * 2,
          selected: selected && sample.kind !== "grass_flowers",
        });
      }
    }

    return { ground: groundInst, props: propList };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    city.seed,
    city.generatorVersion,
    city.terrainOverrides,
    city.roads,
    city.entities,
    tileCam.x,
    tileCam.y,
    tileCam.rot,
    radius,
    selectedHarvest,
  ]);

  return (
    <group>
      <InstancedBlocks instances={ground} castShadow={false} />
      <PropsLayer props={props} />
    </group>
  );
}

export function RoadPreviewLayer({
  tiles,
  city,
}: {
  tiles: { x: bigint; y: bigint }[];
  city: CityState;
}) {
  const instances = useMemo(() => {
    const list: InstanceSpec[] = [];
    for (const t of tiles) {
      const sample = resolveWorldSample(city, t.x, t.y);
      const h = sample.kind === "water" ? 0 : sample.height;
      list.push({
        x: tileToWorld(Number(t.x)),
        y: terrainY(h) + 1.02,
        z: tileToWorld(Number(t.y)),
        mat: "path",
        sx: 0.9,
        sy: 0.15,
        sz: 0.9,
      });
    }
    return list;
  }, [tiles, city]);

  return <InstancedBlocks instances={instances} castShadow={false} />;
}
