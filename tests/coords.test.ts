import { describe, expect, it } from "vitest";
import {
  chunkKey,
  floorDiv,
  worldToChunk,
  chunkLocalToWorld,
  screenToWorld,
  worldToScreen,
  rotateWorld,
  unrotateWorld,
  type ViewRotation,
} from "@/game/simulation/coords";

describe("chunk coordinates", () => {
  it("handles boundaries -1, -32, -33, 0, 31, 32", () => {
    const cases: [bigint, bigint, number, number][] = [
      [0n, 0n, 0, 0],
      [31n, 31n, 31, 31],
      [32n, 32n, 0, 0],
      [-1n, -1n, 31, 31],
      [-32n, -32n, 0, 0],
      [-33n, -33n, 31, 31],
    ];
    for (const [x, y, lx, ly] of cases) {
      const { chunk, local } = worldToChunk(x, y);
      expect(local.lx).toBe(lx);
      expect(local.ly).toBe(ly);
      const back = chunkLocalToWorld(chunk, local);
      expect(back.x).toBe(x);
      expect(back.y).toBe(y);
    }
  });

  it("floorDiv is not truncating division for negatives", () => {
    expect(floorDiv(-1n, 32n)).toBe(-1n);
    expect(floorDiv(-32n, 32n)).toBe(-1n);
    expect(floorDiv(-33n, 32n)).toBe(-2n);
  });

  it("chunk keys are exact decimal strings", () => {
    expect(chunkKey(-1n, 2n)).toBe("-1,2");
  });

  it("screen round-trip near floating origin", () => {
    const { sx, sy } = worldToScreen(5, 3, 2, 2);
    const { wx, wy } = screenToWorld(sx, sy, 2, 2);
    expect(wx).toBeCloseTo(5, 5);
    expect(wy).toBeCloseTo(3, 5);
  });

  it("view rotation round-trips for all quarter turns", () => {
    for (const rot of [0, 1, 2, 3] as ViewRotation[]) {
      const r = rotateWorld(3, -2, rot);
      const back = unrotateWorld(r.x, r.y, rot);
      expect(back.x).toBe(3);
      expect(back.y).toBe(-2);
    }
  });
});
