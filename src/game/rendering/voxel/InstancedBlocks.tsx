"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BLOCK_COLORS, type BlockMat } from "./voxelPalette";

export interface InstanceSpec {
  x: number;
  y: number;
  z: number;
  mat: BlockMat;
  /** Uniform scale (default ~0.98). Ignored if sx/sy/sz set. */
  scale?: number;
  sx?: number;
  sy?: number;
  sz?: number;
}

const _obj = new THREE.Object3D();

/** Round capacity up so small pans don't remount the GPU buffer every frame. */
function capacityFor(count: number): number {
  const padded = Math.max(64, count);
  // Next multiple of 2048
  return Math.ceil(padded / 2048) * 2048;
}

/** One InstancedMesh per material for unit cubes (optionally non-uniform scale). */
export function InstancedBlocks({
  instances,
  castShadow = true,
}: {
  instances: InstanceSpec[];
  castShadow?: boolean;
}) {
  const byMat = useMemo(() => {
    const map = new Map<BlockMat, InstanceSpec[]>();
    for (const inst of instances) {
      const list = map.get(inst.mat);
      if (list) list.push(inst);
      else map.set(inst.mat, [inst]);
    }
    return map;
  }, [instances]);

  return (
    <>
      {[...byMat.entries()].map(([mat, list]) => (
        <BlockBatch
          key={mat}
          mat={mat}
          list={list}
          castShadow={castShadow}
          capacity={capacityFor(list.length)}
        />
      ))}
    </>
  );
}

function BlockBatch({
  mat,
  list,
  castShadow,
  capacity,
}: {
  mat: BlockMat;
  list: InstanceSpec[];
  castShadow: boolean;
  capacity: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const color = BLOCK_COLORS[mat];

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const count = Math.min(list.length, capacity);
    for (let i = 0; i < count; i++) {
      const b = list[i]!;
      const sx = b.sx ?? b.scale ?? 0.98;
      const sy = b.sy ?? b.scale ?? 0.98;
      const sz = b.sz ?? b.scale ?? 0.98;
      // Anchor at footprint corner; grow up in Y for extrusions
      _obj.position.set(b.x + 0.5, b.y + sy / 2, b.z + 0.5);
      _obj.scale.set(sx, sy, sz);
      _obj.updateMatrix();
      mesh.setMatrixAt(i, _obj.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = count;
    // Instances live in world tile space far from the mesh origin.
    mesh.frustumCulled = false;
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1e6);
  }, [list, capacity]);

  if (list.length === 0) return null;

  return (
    <instancedMesh
      // Remount when capacity bucket changes so we never silently truncate.
      key={`${mat}-${capacity}`}
      ref={meshRef}
      args={[undefined, undefined, capacity]}
      castShadow={castShadow}
      receiveShadow
      frustumCulled={false}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={color}
        roughness={mat === "water" ? 0.15 : 0.85}
        metalness={mat === "gold" || mat === "portal" || mat === "portalCore" ? 0.35 : 0}
        transparent={mat === "water"}
        opacity={mat === "water" ? 0.85 : 1}
        depthWrite={mat !== "water"}
        // Nudge depth for coplanar neighbor faces (grass/dirt/path abutting).
        polygonOffset
        polygonOffsetFactor={mat === "path" || mat === "gold" ? -1 : 1}
        polygonOffsetUnits={mat === "path" || mat === "gold" ? -1 : 1}
      />
    </instancedMesh>
  );
}
