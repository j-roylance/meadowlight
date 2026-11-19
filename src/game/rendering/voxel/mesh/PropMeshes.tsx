"use client";

import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { C } from "./Mat";
import { sharedMat } from "./sharedMat";

/** Stable 0..n-1 pick from tile key / coords. */
export function propVariant(seed: string | number, mod: number): number {
  let h = typeof seed === "number" ? seed : 2166136261;
  if (typeof seed === "string") {
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return ((h >>> 0) % mod + mod) % mod;
}

export type PropKind = "tree" | "stone_pile" | "grass_flowers";

export interface PropPlacement {
  key: string;
  kind: PropKind;
  x: number;
  y: number;
  z: number;
  variant?: number;
  yaw?: number;
  selected?: boolean;
}

const _obj = new THREE.Object3D();
const _local = new THREE.Object3D();
const _mat = new THREE.Matrix4();

function capacityFor(count: number): number {
  return Math.ceil(Math.max(64, count) / 1024) * 1024;
}

function writePart(
  mesh: THREE.InstancedMesh,
  index: number,
  base: PropPlacement,
  lx: number,
  ly: number,
  lz: number,
  sx: number,
  sy: number,
  sz: number,
  extraYaw = 0
) {
  const yaw = (base.yaw ?? 0) + extraYaw;
  const s = 0.88 + ((base.variant ?? 0) % 5) * 0.06;
  _obj.position.set(base.x + 0.5, base.y, base.z + 0.5);
  _obj.rotation.set(0, yaw, 0);
  _obj.scale.set(s, s, s);
  _obj.updateMatrix();

  _local.position.set(lx, ly, lz);
  _local.rotation.set(0, 0, 0);
  _local.scale.set(sx, sy, sz);
  _local.updateMatrix();

  _mat.multiplyMatrices(_obj.matrix, _local.matrix);
  mesh.setMatrixAt(index, _mat);
}

function InstancedPart({
  items,
  geometry,
  color,
  local,
  castShadow = false,
  roughness = 0.85,
}: {
  items: PropPlacement[];
  geometry: ReactNode;
  color: string;
  local: { x: number; y: number; z: number; sx?: number; sy?: number; sz?: number; yaw?: number };
  castShadow?: boolean;
  roughness?: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const capacity = capacityFor(items.length);
  const mat = useMemo(
    () => sharedMat(color, { roughness }),
    [color, roughness]
  );

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const count = Math.min(items.length, capacity);
    const sx = local.sx ?? 1;
    const sy = local.sy ?? 1;
    const sz = local.sz ?? 1;
    for (let i = 0; i < count; i++) {
      writePart(
        mesh,
        i,
        items[i]!,
        local.x,
        local.y,
        local.z,
        sx,
        sy,
        sz,
        local.yaw ?? 0
      );
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = count;
    mesh.frustumCulled = false;
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1e6);
  }, [items, capacity, local.x, local.y, local.z, local.sx, local.sy, local.sz, local.yaw]);

  if (items.length === 0) return null;

  return (
    <instancedMesh
      key={`${color}-${capacity}-${local.x}-${local.y}-${local.z}`}
      ref={meshRef}
      args={[undefined, undefined, capacity]}
      castShadow={castShadow}
      frustumCulled={false}
      material={mat}
    >
      {geometry}
    </instancedMesh>
  );
}

/**
 * Instanced foliage / rocks / flowers across the full terrain disk.
 * (Per-prop React meshes were too heavy once props matched the ground radius.)
 */
export function PropsLayer({ props }: { props: PropPlacement[] }) {
  const { trees, stones, flowers, selected } = useMemo(() => {
    const trees: PropPlacement[] = [];
    const stones: PropPlacement[] = [];
    const flowers: PropPlacement[] = [];
    const selected: PropPlacement[] = [];
    for (const p of props) {
      if (p.selected) selected.push(p);
      if (p.kind === "tree") trees.push(p);
      else if (p.kind === "stone_pile") stones.push(p);
      else flowers.push(p);
    }
    return { trees, stones, flowers, selected };
  }, [props]);

  return (
    <group>
      {/* Trees — trunk + canopy (+ light accent) */}
      <InstancedPart
        items={trees}
        color={C.trunk}
        castShadow
        local={{ x: 0, y: 0.45, z: 0 }}
        geometry={<cylinderGeometry args={[0.08, 0.11, 0.9, 6]} />}
      />
      <InstancedPart
        items={trees}
        color={C.leaf}
        local={{ x: 0, y: 1.15, z: 0, sx: 1, sy: 1, sz: 1 }}
        geometry={<sphereGeometry args={[0.42, 7, 7]} />}
      />
      <InstancedPart
        items={trees}
        color={C.leafLight}
        local={{ x: 0.14, y: 1.32, z: 0.08, sx: 0.55, sy: 0.55, sz: 0.55 }}
        geometry={<sphereGeometry args={[0.42, 6, 6]} />}
      />

      {/* Stones */}
      <InstancedPart
        items={stones}
        color={C.stoneDark}
        castShadow
        local={{ x: -0.1, y: 0.16, z: 0.04 }}
        geometry={<dodecahedronGeometry args={[0.2, 0]} />}
      />
      <InstancedPart
        items={stones}
        color={C.stone}
        local={{ x: 0.12, y: 0.14, z: -0.06, sx: 0.85, sy: 0.85, sz: 0.85 }}
        geometry={<dodecahedronGeometry args={[0.18, 0]} />}
      />

      {/* Flower tufts — three blooms */}
      <InstancedPart
        items={flowers}
        color={C.leaf}
        local={{ x: -0.1, y: 0.07, z: 0.04, sx: 0.35, sy: 1, sz: 0.35 }}
        geometry={<cylinderGeometry args={[0.012, 0.014, 0.14, 4]} />}
      />
      <InstancedPart
        items={flowers}
        color={C.flower}
        local={{ x: -0.1, y: 0.16, z: 0.04, sx: 0.7, sy: 0.7, sz: 0.7 }}
        geometry={<sphereGeometry args={[0.06, 5, 5]} />}
      />
      <InstancedPart
        items={flowers}
        color={C.flowerYellow}
        local={{ x: 0.1, y: 0.15, z: -0.06, sx: 0.65, sy: 0.65, sz: 0.65 }}
        geometry={<sphereGeometry args={[0.06, 5, 5]} />}
      />
      <InstancedPart
        items={flowers}
        color={C.flowerPurple}
        local={{ x: 0.04, y: 0.14, z: 0.1, sx: 0.6, sy: 0.6, sz: 0.6 }}
        geometry={<sphereGeometry args={[0.055, 5, 5]} />}
      />

      {selected.map((p) => (
        <mesh
          key={`sel-${p.key}`}
          position={[p.x + 0.5, p.y + 0.03, p.z + 0.5]}
          material={sharedMat(C.gold, { metalness: 0.3, roughness: 0.55 })}
        >
          <cylinderGeometry args={[0.52, 0.52, 0.05, 12]} />
        </mesh>
      ))}
    </group>
  );
}

/* ─── Legacy single-mesh exports (inspector / one-offs) ───────────── */

function RoundTree() {
  return (
    <group>
      <mesh position={[0, 0.45, 0]} castShadow material={sharedMat(C.trunk)}>
        <cylinderGeometry args={[0.07, 0.11, 0.9, 6]} />
      </mesh>
      <mesh position={[0, 1.15, 0]} material={sharedMat(C.leaf)}>
        <sphereGeometry args={[0.42, 7, 7]} />
      </mesh>
      <mesh position={[0.14, 1.32, 0.08]} material={sharedMat(C.leafLight)}>
        <sphereGeometry args={[0.24, 6, 6]} />
      </mesh>
    </group>
  );
}

export function TreeMesh({ variant = 0 }: { castShadow?: boolean; variant?: number }) {
  void variant;
  return <RoundTree />;
}

export function StonePileMesh({
  variant = 0,
}: {
  castShadow?: boolean;
  variant?: number;
}) {
  void variant;
  return (
    <group>
      <mesh position={[-0.12, 0.16, 0.04]} castShadow material={sharedMat(C.stoneDark)}>
        <dodecahedronGeometry args={[0.2, 0]} />
      </mesh>
      <mesh position={[0.14, 0.14, -0.06]} material={sharedMat(C.stone)}>
        <dodecahedronGeometry args={[0.16, 0]} />
      </mesh>
    </group>
  );
}

export function FlowerTuftMesh({ variant = 0 }: { variant?: number }) {
  void variant;
  return (
    <group>
      <mesh position={[-0.1, 0.16, 0.04]} material={sharedMat(C.flower)}>
        <sphereGeometry args={[0.06, 5, 5]} />
      </mesh>
      <mesh position={[0.1, 0.15, -0.06]} material={sharedMat(C.flowerYellow)}>
        <sphereGeometry args={[0.055, 5, 5]} />
      </mesh>
    </group>
  );
}
