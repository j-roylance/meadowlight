import { CHUNK_SIZE, type ChunkCoord, type LocalCoord, type WorldCoord } from "@/game/types";

/** Floor division that works for negatives (not truncating toward zero). */
export function floorDiv(n: bigint, d: bigint): bigint {
  const q = n / d;
  const r = n % d;
  if (r !== 0n && n < 0n) return q - 1n;
  return q;
}

export function worldToChunk(x: bigint, y: bigint): { chunk: ChunkCoord; local: LocalCoord } {
  const cx = floorDiv(x, BigInt(CHUNK_SIZE));
  const cy = floorDiv(y, BigInt(CHUNK_SIZE));
  const lx = Number(x - cx * BigInt(CHUNK_SIZE));
  const ly = Number(y - cy * BigInt(CHUNK_SIZE));
  return { chunk: { cx, cy }, local: { lx, ly } };
}

export function chunkLocalToWorld(chunk: ChunkCoord, local: LocalCoord): WorldCoord {
  return {
    x: chunk.cx * BigInt(CHUNK_SIZE) + BigInt(local.lx),
    y: chunk.cy * BigInt(CHUNK_SIZE) + BigInt(local.ly),
  };
}

export function chunkKey(cx: bigint, cy: bigint): string {
  return `${cx.toString()},${cy.toString()}`;
}

export function parseChunkKey(key: string): ChunkCoord {
  const [a, b] = key.split(",");
  return { cx: BigInt(a), cy: BigInt(b) };
}

export function tileKey(x: bigint, y: bigint): string {
  return `${x.toString()},${y.toString()}`;
}

export function parseTileKey(key: string): WorldCoord {
  const [a, b] = key.split(",");
  return { x: BigInt(a), y: BigInt(b) };
}

/** Quarter-turns clockwise: 0, 1 (90°), 2 (180°), 3 (270°). */
export type ViewRotation = 0 | 1 | 2 | 3;

/** Rotate world tile coords for a top-down 90° view turn (around origin). */
export function rotateWorld(
  x: number,
  y: number,
  rot: ViewRotation
): { x: number; y: number } {
  switch (rot) {
    case 1:
      return { x: y, y: -x };
    case 2:
      return { x: -x, y: -y };
    case 3:
      return { x: -y, y: x };
    default:
      return { x, y };
  }
}

export function unrotateWorld(
  x: number,
  y: number,
  rot: ViewRotation
): { x: number; y: number } {
  // Inverse of rotateWorld: rotate the other way.
  const inv = ((4 - rot) % 4) as ViewRotation;
  return rotateWorld(x, y, inv);
}

/** Isometric projection relative to a floating origin. */
export function worldToScreen(
  wx: number,
  wy: number,
  originX: number,
  originY: number,
  tileW = 64,
  tileH = 32
): { sx: number; sy: number } {
  const dx = wx - originX;
  const dy = wy - originY;
  return {
    sx: (dx - dy) * (tileW / 2),
    sy: (dx + dy) * (tileH / 2),
  };
}

export function screenToWorld(
  sx: number,
  sy: number,
  originX: number,
  originY: number,
  tileW = 64,
  tileH = 32
): { wx: number; wy: number } {
  const dx = sx / (tileW / 2);
  const dy = sy / (tileH / 2);
  const wx = (dx + dy) / 2 + originX;
  const wy = (dy - dx) / 2 + originY;
  return { wx, wy };
}

export function footprintTiles(
  x: bigint,
  y: bigint,
  w: number,
  h: number
): WorldCoord[] {
  const tiles: WorldCoord[] = [];
  for (let dx = 0; dx < w; dx++) {
    for (let dy = 0; dy < h; dy++) {
      tiles.push({ x: x + BigInt(dx), y: y + BigInt(dy) });
    }
  }
  return tiles;
}
