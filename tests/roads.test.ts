import { describe, expect, it } from "vitest";
import { validateRoadPath } from "@/game/simulation/roads";
import { tileKey } from "@/game/simulation/coords";

describe("roads", () => {
  it("accepts 1–16 orthogonal new tiles", () => {
    const path = Array.from({ length: 16 }, (_, i) => ({
      x: BigInt(i),
      y: 0n,
    }));
    const r = validateRoadPath(path, new Set());
    expect(r.ok).toBe(true);
    expect(r.stoneCost).toBe(16);
  });

  it("rejects more than 16 without truncating", () => {
    const path = Array.from({ length: 17 }, (_, i) => ({
      x: BigInt(i),
      y: 0n,
    }));
    const r = validateRoadPath(path, new Set());
    expect(r.ok).toBe(false);
  });

  it("charges only for new tiles; all-existing is free no-op cost 0", () => {
    const path = [
      { x: 0n, y: 0n },
      { x: 1n, y: 0n },
    ];
    const existing = new Set([tileKey(0n, 0n), tileKey(1n, 0n)]);
    const r = validateRoadPath(path, existing);
    expect(r.ok).toBe(true);
    expect(r.stoneCost).toBe(0);
  });

  it("rejects diagonal paths", () => {
    const r = validateRoadPath(
      [
        { x: 0n, y: 0n },
        { x: 1n, y: 1n },
      ],
      new Set()
    );
    expect(r.ok).toBe(false);
  });
});
