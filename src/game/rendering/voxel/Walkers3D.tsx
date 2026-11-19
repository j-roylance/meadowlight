"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { CityState, PlacedEntity } from "@/game/types";
import { getBuilding } from "@/game/catalog/definitions";
import { walkerCount, MAX_WALKERS } from "@/game/rendering/walkers";
import { rotatedFootprintSize } from "@/game/simulation/coords";
import { resolveWorldSample } from "@/game/simulation/terrain";
import { terrainY, tileToWorld } from "./voxelScale";
import { C, Mat } from "./mesh/Mat";

const SHIRT_COLORS = [
  "#E07A5F",
  "#81B29A",
  "#F2CC8F",
  "#3D405B",
  "#E9C46A",
  "#A8DADC",
  "#F4A261",
  "#90BE6D",
] as const;

interface Route3D {
  id: string;
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
  color: string;
  duration: number;
  delay: number;
}

function isWalkerBuilding(e: PlacedEntity): boolean {
  return !e.stored && e.definitionId !== "portal";
}

function anchor(city: CityState, e: PlacedEntity) {
  const def = getBuilding(e.definitionId);
  const { w, h } = rotatedFootprintSize(def.footprint.w, def.footprint.h, e.rotation);
  const x = tileToWorld(Number(e.x)) + w * 0.5;
  const z = tileToWorld(Number(e.y)) + h * 0.5;
  const sample = resolveWorldSample(city, e.x, e.y);
  const y = terrainY(sample.kind === "water" ? 0 : sample.height) + 1.05;
  return { x, y, z };
}

function buildRoutes(city: CityState): Route3D[] {
  const n = Math.min(MAX_WALKERS, walkerCount(city));
  if (n <= 0) return [];
  const buildings = city.entities.filter(isWalkerBuilding);
  if (buildings.length < 2) return [];
  const anchors = buildings.map((e) => anchor(city, e));
  const routes: Route3D[] = [];
  for (let i = 0; i < n; i++) {
    const a = anchors[i % anchors.length]!;
    const b = anchors[(i * 3 + 1) % anchors.length]!;
    routes.push({
      id: `vw-${i}`,
      ax: a.x,
      ay: a.y,
      az: a.z,
      bx: b.x,
      by: b.y,
      bz: b.z,
      color: SHIRT_COLORS[i % SHIRT_COLORS.length]!,
      duration: 7 + (i % 5) * 1.4,
      delay: (i * 0.9) % 4,
    });
  }
  return routes;
}

function NpcMesh({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[-0.055, 0.16, 0]} castShadow>
        <capsuleGeometry args={[0.04, 0.14, 3, 6]} />
        <Mat color={C.woodDark} />
      </mesh>
      <mesh position={[0.055, 0.16, 0]} castShadow>
        <capsuleGeometry args={[0.04, 0.14, 3, 6]} />
        <Mat color={C.woodDark} />
      </mesh>
      <mesh position={[0, 0.46, 0]} castShadow>
        <capsuleGeometry args={[0.1, 0.2, 4, 8]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[-0.14, 0.48, 0]} rotation={[0, 0, 0.35]} castShadow>
        <capsuleGeometry args={[0.032, 0.12, 3, 5]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0.14, 0.48, 0]} rotation={[0, 0, -0.35]} castShadow>
        <capsuleGeometry args={[0.032, 0.12, 3, 5]} />
        <Mat color={color} />
      </mesh>
      <mesh position={[0, 0.74, 0]} castShadow>
        <sphereGeometry args={[0.1, 8, 8]} />
        <Mat color={C.cream} />
      </mesh>
    </group>
  );
}

function WalkerMesh({
  route,
  reducedMotion,
}: {
  route: Route3D;
  reducedMotion?: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    if (reducedMotion) {
      g.position.set(
        (route.ax + route.bx) / 2,
        (route.ay + route.by) / 2,
        (route.az + route.bz) / 2
      );
      return;
    }
    const t =
      ((clock.elapsedTime + route.delay) % route.duration) / route.duration;
    const s = t < 0.5 ? t * 2 : 2 - t * 2;
    const x = route.ax + (route.bx - route.ax) * s;
    const y = route.ay + (route.by - route.ay) * s;
    const z = route.az + (route.bz - route.az) * s;
    g.position.set(x, y, z);
    const dx = route.bx - route.ax;
    const dz = route.bz - route.az;
    if (Math.abs(dx) + Math.abs(dz) > 0.001) {
      // Face along current travel direction (out then back)
      const dir = t < 0.5 ? 1 : -1;
      g.rotation.y = Math.atan2(dx * dir, dz * dir);
    }
  });

  return (
    <group ref={ref}>
      <NpcMesh color={route.color} />
    </group>
  );
}

export function Walkers3D({
  city,
  reducedMotion,
}: {
  city: CityState;
  reducedMotion?: boolean;
}) {
  const routes = useMemo(
    () => buildRoutes(city),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [city.entities, city.economy.happiness, city.seed, city.terrainOverrides]
  );

  return (
    <group>
      {routes.map((r) => (
        <WalkerMesh key={r.id} route={r} reducedMotion={reducedMotion} />
      ))}
    </group>
  );
}
