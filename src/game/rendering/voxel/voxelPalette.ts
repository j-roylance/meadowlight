import type { CityBiome } from "@/game/simulation/terrain";
import { palette } from "@/game/rendering/palette";

export type BlockMat =
  | "grass"
  | "grassSide"
  | "dirt"
  | "sand"
  | "sandDeep"
  | "water"
  | "stone"
  | "stoneDark"
  | "snow"
  | "leaf"
  | "leafLight"
  | "wood"
  | "woodDark"
  | "flower"
  | "flowerYellow"
  | "flowerPurple"
  | "path"
  | "pathStone"
  | "wall"
  | "wallWarm"
  | "wallStone"
  | "roof"
  | "roofDark"
  | "thatch"
  | "moss"
  | "window"
  | "portal"
  | "portalCore"
  | "gold"
  | "cream"
  | "rocket"
  | "metal"
  | "savanna"
  | "jungle"
  | "badlands"
  | "taiga";

export const BLOCK_COLORS: Record<BlockMat, string> = {
  grass: palette.grassMid,
  grassSide: palette.grassDark,
  dirt: "#8B6A45",
  sand: palette.sand,
  sandDeep: palette.sandDeep,
  water: palette.waterDeep,
  stone: palette.stone,
  stoneDark: palette.stoneDark,
  snow: "#F2F6FA",
  leaf: palette.treeCanopy,
  leafLight: palette.treeCanopyLight,
  wood: palette.wood,
  woodDark: palette.woodDark,
  flower: palette.flowerPink,
  flowerYellow: palette.flowerYellow,
  flowerPurple: palette.flowerPurple,
  path: palette.pathDirt,
  pathStone: palette.pathStone,
  wall: palette.wallCream,
  wallWarm: palette.wallWarm,
  wallStone: palette.wallStone,
  roof: palette.roofClay,
  roofDark: palette.roofClayDark,
  thatch: palette.roofThatch,
  moss: palette.roofMoss,
  window: palette.windowGlow,
  portal: palette.portalGlow,
  portalCore: "#F4FAFF",
  gold: "#E8C060",
  cream: palette.cream,
  rocket: "#F4EEE0",
  metal: "#C8D0D8",
  savanna: "#C4B06A",
  jungle: "#3F7A3A",
  badlands: "#C4785A",
  taiga: "#6A8A6A",
};

export function biomeTopMat(biome: CityBiome): BlockMat {
  switch (biome) {
    case "desert":
    case "beach":
    case "coast":
      return "sand";
    case "badlands":
      return "badlands";
    case "mountain":
      return "stone";
    case "alpine":
    case "snow":
      return "snow";
    case "wetland":
    case "swamp":
      return "grassSide";
    case "ocean":
    case "lake":
    case "river":
      return "water";
    case "forest":
      return "grassSide";
    case "jungle":
      return "jungle";
    case "taiga":
      return "taiga";
    case "savanna":
      return "savanna";
    case "meadow":
      return "grass";
    case "hills":
      return "grass";
    default:
      return "grass";
  }
}

export function biomeSideMat(biome: CityBiome): BlockMat {
  switch (biome) {
    case "desert":
      return "sandDeep";
    case "beach":
    case "coast":
      return "sand";
    case "badlands":
      return "roofDark";
    case "mountain":
    case "alpine":
      return "stoneDark";
    case "snow":
      return "stone";
    case "ocean":
    case "lake":
    case "river":
      return "water";
    case "jungle":
      return "dirt";
    case "savanna":
      return "sand";
    default:
      return "dirt";
  }
}
