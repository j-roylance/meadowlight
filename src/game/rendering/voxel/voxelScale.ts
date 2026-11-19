/**
 * Unified Minecraft-style scale: one voxel = one gameplay tile.
 * Terrain, buildings, and props all share this grid.
 */
export const VOXELS_PER_TILE = 1;

/** Vertical blocks per terrain height step (unified with tile blocks). */
export const HEIGHT_VOXELS = 1;

export function tileToWorld(tile: number, local = 0): number {
  return tile * VOXELS_PER_TILE + local;
}

export function worldToTile(world: number): number {
  return Math.floor(world / VOXELS_PER_TILE);
}

/** World Y of the top surface block for a terrain height. */
export function terrainY(height: number, local = 0): number {
  return height * HEIGHT_VOXELS + local;
}
