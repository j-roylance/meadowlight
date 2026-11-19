"use client";

import { palette } from "@/game/rendering/palette";

/** Shared cozy meadow materials for mesh objects. */
export function Mat({
  color,
  roughness = 0.85,
  metalness = 0,
  emissive,
  emissiveIntensity = 0,
  transparent,
  opacity = 1,
}: {
  color: string;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
}) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={roughness}
      metalness={metalness}
      emissive={emissive ?? "#000000"}
      emissiveIntensity={emissiveIntensity}
      transparent={transparent}
      opacity={opacity}
    />
  );
}

export const C = {
  wall: palette.wallCream,
  wallWarm: palette.wallWarm,
  wallStone: palette.wallStone,
  roof: palette.roofClay,
  roofDark: palette.roofClayDark,
  thatch: palette.roofThatch,
  moss: palette.roofMoss,
  wood: palette.wood,
  woodDark: palette.woodDark,
  window: palette.windowGlow,
  stone: palette.stone,
  stoneDark: palette.stoneDark,
  leaf: palette.treeCanopy,
  leafLight: palette.treeCanopyLight,
  leafDeep: palette.grassDark,
  trunk: palette.treeTrunk,
  flower: palette.flowerPink,
  flowerYellow: palette.flowerYellow,
  flowerPurple: palette.flowerPurple,
  flowerCoral: "#E8907A",
  flowerWhite: "#F4EEE0",
  grass: palette.grassMid,
  water: palette.waterDeep,
  path: palette.pathDirt,
  pathStone: palette.pathStone,
  portal: palette.portalGlow,
  portalRing: palette.portalRing,
  gold: "#E8C060",
  cream: palette.cream,
  rocket: "#F4EEE0",
  metal: "#C8D0D8",
  shutter: "#6A8A9A",
  terracotta: "#C4785A",
} as const;
