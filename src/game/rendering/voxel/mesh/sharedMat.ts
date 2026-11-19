"use client";

import * as THREE from "three";

const cache = new Map<string, THREE.MeshStandardMaterial>();

/** Reuse MeshStandardMaterials across foliage/prop instances (big draw-call win). */
export function sharedMat(
  color: string,
  opts: {
    roughness?: number;
    metalness?: number;
    emissive?: string;
    emissiveIntensity?: number;
    transparent?: boolean;
    opacity?: number;
  } = {}
): THREE.MeshStandardMaterial {
  const key = [
    color,
    opts.roughness ?? 0.85,
    opts.metalness ?? 0,
    opts.emissive ?? "",
    opts.emissiveIntensity ?? 0,
    opts.transparent ? 1 : 0,
    opts.opacity ?? 1,
  ].join("|");
  let mat = cache.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.85,
      metalness: opts.metalness ?? 0,
      emissive: opts.emissive ?? "#000000",
      emissiveIntensity: opts.emissiveIntensity ?? 0,
      transparent: opts.transparent,
      opacity: opts.opacity ?? 1,
    });
    cache.set(key, mat);
  }
  return mat;
}
