"use client";

import { useMemo } from "react";
import type { BuildingDefId, CityState, PlacedEntity, WorldCoord } from "@/game/types";
import { getBuilding } from "@/game/catalog/definitions";
import { rotatedFootprintSize } from "@/game/simulation/coords";
import { resolveWorldSample } from "@/game/simulation/terrain";
import { terrainY, tileToWorld } from "./voxelScale";
import { BuildingMesh } from "./mesh/BuildingMesh";
import { C, Mat } from "./mesh/Mat";

function entityGroundY(city: CityState, e: PlacedEntity): number {
  const sample = resolveWorldSample(city, e.x, e.y);
  return sample.kind === "water" ? 0 : sample.height;
}

/** Yaw so stored degrees match clockwise-from-above (Three.js +Y is CCW). */
function buildingYaw(rotation: 0 | 90 | 180 | 270): number {
  return -((rotation * Math.PI) / 180);
}

function RotatedBuilding({
  definitionId,
  level,
  stage,
  projectType,
  rotation,
  footprintW,
  footprintH,
}: {
  definitionId: BuildingDefId;
  level?: 1 | 2;
  stage?: string;
  projectType?: string;
  rotation: 0 | 90 | 180 | 270;
  footprintW: number;
  footprintH: number;
}) {
  const cx = footprintW / 2;
  const cz = footprintH / 2;
  return (
    <group position={[cx, 0, cz]} rotation={[0, buildingYaw(rotation), 0]}>
      <group position={[-cx, 0, -cz]}>
        <BuildingMesh
          definitionId={definitionId}
          level={level}
          stage={stage}
          projectType={projectType}
        />
      </group>
    </group>
  );
}

export function BuildingsLayer({
  city,
  selectedEntityId,
}: {
  city: CityState;
  selectedEntityId?: string | null;
}) {
  const items = useMemo(() => {
    return city.entities
      .filter((e) => !e.stored)
      .map((e) => {
        const baseY = terrainY(entityGroundY(city, e)) + 1;
        const ox = tileToWorld(Number(e.x));
        const oz = tileToWorld(Number(e.y));
        return { e, baseY, ox, oz };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city.entities, city.seed, city.generatorVersion, city.terrainOverrides]);

  return (
    <group>
      {items.map(({ e, baseY, ox, oz }) => {
        const selected = e.id === selectedEntityId;
        const def = getBuilding(e.definitionId);
        const { w, h } = rotatedFootprintSize(def.footprint.w, def.footprint.h, e.rotation);
        const span = Math.max(w, h);
        return (
          <group key={e.id} position={[ox, baseY, oz]}>
            <RotatedBuilding
              definitionId={e.definitionId}
              level={e.level}
              stage={e.appearance?.stage}
              projectType={e.appearance?.projectType}
              rotation={e.rotation}
              footprintW={def.footprint.w}
              footprintH={def.footprint.h}
            />
            {selected && (
              <mesh position={[w / 2, 0.04, h / 2]}>
                <cylinderGeometry args={[span * 0.55, span * 0.55, 0.06, 20]} />
                <Mat color={C.gold} metalness={0.35} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

export function GhostBuilding({
  city,
  defId,
  tile,
  valid,
  projectType,
  rotation = 0,
}: {
  city: CityState;
  defId: BuildingDefId;
  tile: WorldCoord;
  valid?: boolean;
  /** When placing a hosted project, preview the finished landmark. */
  projectType?: string;
  rotation?: 0 | 90 | 180 | 270;
}) {
  const sample = resolveWorldSample(city, tile.x, tile.y);
  const h = sample.kind === "water" ? 0 : sample.height;
  const baseY = terrainY(h) + 1;
  const ox = tileToWorld(Number(tile.x));
  const oz = tileToWorld(Number(tile.y));
  const def = getBuilding(defId);
  const size = rotatedFootprintSize(def.footprint.w, def.footprint.h, rotation);
  const span = Math.max(size.w, size.h);

  return (
    <group position={[ox, baseY, oz]}>
      <RotatedBuilding
        definitionId={defId}
        stage={projectType ? "complete" : undefined}
        projectType={projectType}
        rotation={rotation}
        footprintW={def.footprint.w}
        footprintH={def.footprint.h}
      />
      <mesh position={[size.w / 2, 0.05, size.h / 2]}>
        <cylinderGeometry args={[span * 0.5, span * 0.5, 0.08, 16]} />
        <Mat
          color={valid ? C.grass : C.roofDark}
          transparent
          opacity={0.7}
        />
      </mesh>
    </group>
  );
}
