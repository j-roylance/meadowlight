import { describe, expect, it } from 'vitest';
import { createStarterCity } from '@/game/simulation/starter';
import { getBuilding } from '@/game/catalog/definitions';
import { occupiedTiles } from '@/game/simulation/placement';
import { tileKey } from '@/game/simulation/coords';

describe('starter layout', () => {
  it('town hall is 3x3 and nothing overlaps roads or entities', () => {
    expect(getBuilding('town_hall').footprint).toEqual({ w: 3, h: 3 });
    const city = createStarterCity({
      id: 't', ownerId: 'o', name: 'T', displayName: 'T',
      specialty: 'markets', now: 0, seed: 1,
    });
    const occ = occupiedTiles(city);
    for (const r of city.roads) {
      expect(occ.has(tileKey(r.x, r.y)), `road at ${r.x},${r.y}`).toBe(false);
    }
    const seen = new Map<string, string>();
    for (const e of city.entities) {
      const def = getBuilding(e.definitionId);
      for (let dx = 0; dx < def.footprint.w; dx++) {
        for (let dy = 0; dy < def.footprint.h; dy++) {
          const k = tileKey(e.x + BigInt(dx), e.y + BigInt(dy));
          expect(seen.has(k), `overlap ${k}`).toBe(false);
          seen.set(k, e.definitionId);
        }
      }
    }
  });
});

